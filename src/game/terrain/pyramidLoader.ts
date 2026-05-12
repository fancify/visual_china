// terrain/pyramidLoader.ts — 加载 + 缓存 DEM pyramid chunks
//
// 单 instance per scene。管理:
//   - PyramidManifest (一次 fetch)
//   - LoadedChunk LRU cache (per tier)
//   - 距离 camera 自动选 tier
//   - 异步 fetch + 解码
//
// 不渲染——只管数据。renderer (pyramidMesh) 拿数据画 mesh。

import {
  PyramidManifest,
  TierName,
  LoadedChunk
} from "./pyramidTypes.js";
import { decodePyramidChunk } from "./pyramidDecode.js";

const TIER_NAMES: TierName[] = ["L0", "L1", "L2", "L3", "L4"];

interface PyramidLoaderOptions {
  /** base path to pyramid data, default "/data/dem" */
  baseUrl?: string;
  /** max chunks to keep in memory per tier; default 64 */
  maxChunksPerTier?: number;
}

export class PyramidLoader {
  readonly baseUrl: string;
  readonly maxChunksPerTier: number;

  private manifest: PyramidManifest | null = null;
  private manifestPromise: Promise<PyramidManifest> | null = null;
  private chunkCache = new Map<string, LoadedChunk>();
  /** chunks currently being fetched (dedup concurrent requests) */
  private inflightFetches = new Map<string, Promise<LoadedChunk | null>>();
  /** keys known to NOT exist on server (404 / fallback) — avoid re-fetch */
  private missingChunks = new Set<string>();
  private now = 0;

  constructor(opts: PyramidLoaderOptions = {}) {
    this.baseUrl = opts.baseUrl ?? "/data/dem";
    this.maxChunksPerTier = opts.maxChunksPerTier ?? 64;
  }

  /** Fetch manifest (cached); call before first use. */
  async loadManifest(): Promise<PyramidManifest> {
    if (this.manifest) return this.manifest;
    if (!this.manifestPromise) {
      this.manifestPromise = fetch(`${this.baseUrl}/manifest.json`)
        .then((r) => {
          if (!r.ok) throw new Error(`manifest fetch failed: HTTP ${r.status}`);
          return r.json() as Promise<PyramidManifest>;
        })
        .then((m) => {
          this.manifest = m;
          return m;
        });
    }
    return this.manifestPromise;
  }

  /** Get loaded chunk synchronously (null if not loaded). */
  getCachedChunk(tier: TierName, chunkX: number, chunkZ: number): LoadedChunk | null {
    const key = this.cacheKey(tier, chunkX, chunkZ);
    const chunk = this.chunkCache.get(key) ?? null;
    if (chunk) chunk.lastUsed = ++this.now;
    return chunk;
  }

  /** Request chunk; resolves null if chunk doesn't exist on server (ocean / out-of-bounds). */
  async requestChunk(
    tier: TierName,
    chunkX: number,
    chunkZ: number
  ): Promise<LoadedChunk | null> {
    const key = this.cacheKey(tier, chunkX, chunkZ);
    if (this.missingChunks.has(key)) return null;
    const cached = this.chunkCache.get(key);
    if (cached) {
      cached.lastUsed = ++this.now;
      return cached;
    }
    const inflight = this.inflightFetches.get(key);
    if (inflight) return inflight;

    const promise = this.fetchChunk(tier, chunkX, chunkZ);
    this.inflightFetches.set(key, promise);
    try {
      const chunk = await promise;
      if (chunk) {
        this.chunkCache.set(key, chunk);
        this.evictIfFull(tier);
      } else {
        this.missingChunks.add(key);
      }
      return chunk;
    } finally {
      this.inflightFetches.delete(key);
    }
  }

  /** Synchronously check if chunk known missing (404/cached) */
  isKnownMissing(tier: TierName, chunkX: number, chunkZ: number): boolean {
    return this.missingChunks.has(this.cacheKey(tier, chunkX, chunkZ));
  }

  /**
   * Pick the best tier for a given camera-to-chunk distance.
   * Heuristic: switch tier roughly every 50 km.
   */
  pickTierForDistance(distanceKm: number): TierName {
    if (distanceKm < 30) return "L0";
    if (distanceKm < 90) return "L1";
    if (distanceKm < 240) return "L2";
    if (distanceKm < 600) return "L3";
    return "L4";
  }

  // ─── Internals ─────────────────────────────────────────────────

  private cacheKey(tier: TierName, x: number, z: number): string {
    return `${tier}:${x}:${z}`;
  }

  private async fetchChunk(
    tier: TierName,
    chunkX: number,
    chunkZ: number
  ): Promise<LoadedChunk | null> {
    if (!this.manifest) await this.loadManifest();
    const tierMeta = this.manifest!.tiers[tier];
    if (!tierMeta) return null;

    // bounds check via manifest range (跳过 null - build script edge case)
    const [xMin, xMax] = tierMeta.chunkRangeX;
    const [zMin, zMax] = tierMeta.chunkRangeZ;
    if (Number.isFinite(xMin) && Number.isFinite(xMax)) {
      if (chunkX < xMin || chunkX > xMax) return null;
    }
    if (Number.isFinite(zMin) && Number.isFinite(zMax)) {
      if (chunkZ < zMin || chunkZ > zMax) return null;
    }

    const url = `${this.baseUrl}/${tier}/${chunkX}_${chunkZ}.bin`;
    const resp = await fetch(url);
    if (resp.status === 404) {
      return null; // ocean / sparse tier
    }
    if (!resp.ok) {
      throw new Error(`chunk fetch failed ${tier} ${chunkX},${chunkZ}: HTTP ${resp.status}`);
    }
    // Vite dev server SPA fallback: 不存在的 .bin 文件返回 200 + index.html
    // Content-Type 检查兜底 — 真 chunk 是 application/octet-stream 或 absent
    const contentType = resp.headers.get("content-type") || "";
    if (contentType.includes("text/html")) {
      return null;
    }
    const buf = await resp.arrayBuffer();
    // 大小防御: 真 chunk 是 8 header + N²*2 (v1) 或 8 + (N+2)²*2 (v2 ghost). N=256 →
    // v1=131080, v2=133136. 其他大小一律拒, 防 Vite SPA fallback HTML 误读.
    if (buf.byteLength !== 131080 && buf.byteLength !== 133136) {
      return null;
    }
    const decoded = decodePyramidChunk(buf);

    // Compute geographic bounds
    const size = tierMeta.chunkSizeDeg;
    const bounds = {
      west: this.manifest!.bounds.west + chunkX * size,
      east: this.manifest!.bounds.west + (chunkX + 1) * size,
      north: this.manifest!.bounds.north - chunkZ * size,
      south: this.manifest!.bounds.north - (chunkZ + 1) * size
    };

    return {
      tier,
      chunkX,
      chunkZ,
      bounds,
      heights: decoded.heights,
      cellsPerChunk: decoded.cellsPerChunk,
      ghostWidth: decoded.ghostWidth,
      lastUsed: ++this.now
    };
  }

  private evictIfFull(tier: TierName): void {
    const tierChunks = Array.from(this.chunkCache.entries()).filter(([k]) =>
      k.startsWith(`${tier}:`)
    );
    if (tierChunks.length <= this.maxChunksPerTier) return;
    tierChunks.sort((a, b) => a[1].lastUsed - b[1].lastUsed);
    const toEvict = tierChunks.length - this.maxChunksPerTier;
    for (let i = 0; i < toEvict; i += 1) {
      this.chunkCache.delete(tierChunks[i][0]);
    }
  }

  /** debug: total chunks cached */
  cacheSize(): number {
    return this.chunkCache.size;
  }
}
