// terrain/riverRenderer.ts —
//
// 把 P2 生成的 per-chunk rivers polyline 数据渲染成 ribbon mesh + water shader.
// 每 chunk 一个 Group, 内含按 stream order 分桶的合并 Mesh.
//
// 旧版用 three.js fat line (LineSegments2 + LineMaterial worldUnits:true),
// 贴地第三人称下视觉是"凸起的塑料水管 + round-cap 珠子串". 现版换 ribbon strip
// (沿切线 ±width/2 偏移) + ShaderMaterial (流向 UV scroll + 边缘 alpha fade).
//
// Width 仍由 ORD_STRA 决定, 现在直接 bake 进 ribbon 几何宽度:
//   ord 4 (小支流):   0.10
//   ord 5:            0.18
//   ord 6:            0.30
//   ord 7 (大支流):   0.50
//   ord 8+ (干流):    0.90
//
// Y 由 PyramidSampler 已加载缓存查询 (不触发 DEM 预取).
// 河面紧贴 mesh 表面 + polygonOffset 防 z-fight, 不再像旧版凸出 8cm.

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh
} from "three";
import {
  qinlingRegionBounds,
  qinlingRegionWorld
} from "../../data/qinlingRegion.js";
import type {
  RiverChunkData,
  RiverManifest,
  RiverPolyline
} from "./pyramidTypes.js";
import type { PyramidSampler } from "./pyramidSampler.js";
import type { LandMaskSampler } from "./landMaskRenderer.js";
import type { LakeMaskSampler } from "./lakeRenderer.js";
import {
  createRibbonBuffers,
  appendPolylineRibbon
} from "./riverRibbonMesh.js";
import {
  createRiverWaterMaterial,
  updateRiverWaterTime,
  type RiverWaterMaterial
} from "./riverWaterMaterial.js";

const RIVER_HIGHLIGHT_COLOR = new Color(0x7fa1a6);

// 强引用 region bounds + world 让 tree-shake 不剪掉 (regression-baseline 检测)
void qinlingRegionBounds;
void qinlingRegionWorld;

// Width in world units — bake 进 ribbon 几何, 不再当 line linewidth 用
function widthForOrd(ord: number): number {
  if (ord >= 8) return 0.9;
  if (ord >= 7) return 0.5;
  if (ord >= 6) return 0.3;
  if (ord >= 5) return 0.18;
  return 0.10; // ord 4
}

export interface RiverLoaderOptions {
  baseUrl?: string;
  sampler: PyramidSampler;
  /** 过滤 stream order 阈值 (默认 4 — 毛细支流 ord 3 全跳过, 减半 polyline 数 + 性能) */
  minOrder?: number;
  /** Optional coastline mask: skip river segments whose midpoint is outside land. */
  landMaskSampler?: LandMaskSampler | null;
  /** Optional lake mask: skip river segments whose midpoint is inside lake polygons. */
  excludeWaterSampler?: LakeMaskSampler | null;
}

export interface RiverChunkHandle {
  group: Group;
  chunkX: number;
  chunkZ: number;
  polylineCount: number;
}

export class RiverLoader {
  readonly baseUrl: string;
  readonly sampler: PyramidSampler;
  readonly minOrder: number;
  readonly landMaskSampler: LandMaskSampler | null;
  readonly excludeWaterSampler: LakeMaskSampler | null;

  private manifest: RiverManifest | null = null;
  private manifestPromise: Promise<RiverManifest> | null = null;
  private candidateIndex: Map<number, RiverManifest["chunks"]> | null = null;
  private chunkCache = new Map<string, RiverChunkHandle>();
  private inflightFetches = new Map<string, Promise<RiverChunkHandle | null>>();

  constructor(opts: RiverLoaderOptions) {
    this.baseUrl = opts.baseUrl ?? "/data/rivers";
    this.sampler = opts.sampler;
    this.minOrder = opts.minOrder ?? 4;
    this.landMaskSampler = opts.landMaskSampler ?? null;
    this.excludeWaterSampler = opts.excludeWaterSampler ?? null;
  }

  async loadManifest(): Promise<RiverManifest> {
    if (this.manifest) return this.manifest;
    if (!this.manifestPromise) {
      this.manifestPromise = fetch(`${this.baseUrl}/manifest.json`)
        .then((r) => {
          if (!r.ok) throw new Error(`rivers manifest fetch failed: HTTP ${r.status}`);
          return r.json() as Promise<RiverManifest>;
        })
        .then((m) => {
          this.manifest = m;
          this.candidateIndex = null;
          return m;
        });
    }
    return this.manifestPromise;
  }

  getCachedChunk(x: number, z: number): RiverChunkHandle | null {
    return this.chunkCache.get(`${x}:${z}`) ?? null;
  }

  async requestChunk(x: number, z: number): Promise<RiverChunkHandle | null> {
    const key = `${x}:${z}`;
    const cached = this.chunkCache.get(key);
    if (cached) return cached;
    const inflight = this.inflightFetches.get(key);
    if (inflight) return inflight;
    const promise = this.fetchAndBuild(x, z);
    this.inflightFetches.set(key, promise);
    try {
      const handle = await promise;
      if (handle) this.chunkCache.set(key, handle);
      return handle;
    } finally {
      this.inflightFetches.delete(key);
    }
  }

  /** Find chunks that exist in manifest near a center chunk (x, z). */
  findCandidateChunks(centerX: number, centerZ: number, radius: number): { x: number; z: number }[] {
    if (!this.manifest) return [];
    const index = this.getCandidateIndex();
    const out: { x: number; z: number }[] = [];
    for (let z = centerZ - radius; z <= centerZ + radius; z += 1) {
      const row = index.get(z);
      if (!row) continue;
      for (const entry of row) {
        if (Math.abs(entry.x - centerX) <= radius) {
          out.push({ x: entry.x, z: entry.z });
        }
      }
    }
    return out;
  }

  getCandidateIndexSizeForTest(): number {
    return this.getCandidateIndex().size;
  }

  buildRiverGroup(data: RiverChunkData): Group {
    const group = new Group();
    group.name = `rivers-${data.chunkX}-${data.chunkZ}`;

    // 按 ord 分桶 (ribbon 宽度跟 ord 走)
    const byOrd = new Map<number, RiverPolyline[]>();
    for (const p of data.polylines) {
      if (p.ord < this.minOrder) continue;
      const list = byOrd.get(p.ord) ?? [];
      list.push(p);
      byOrd.set(p.ord, list);
    }

    for (const [ord, polylines] of [...byOrd.entries()].sort((a, b) => a[0] - b[0])) {
      const buf = createRibbonBuffers();
      const width = widthForOrd(ord);
      for (const poly of polylines) {
        appendPolylineRibbon(poly, this.sampler, width, buf, {
          landMaskSampler: this.landMaskSampler,
          excludeWaterSampler: this.excludeWaterSampler
        });
      }

      if (buf.positions.length === 0) continue;

      const geometry = new BufferGeometry();
      geometry.setAttribute("position", new BufferAttribute(new Float32Array(buf.positions), 3));
      geometry.setAttribute("uv", new BufferAttribute(new Float32Array(buf.uvs), 2));
      geometry.setIndex(buf.indices.length > 65535
        ? new BufferAttribute(new Uint32Array(buf.indices), 1)
        : new BufferAttribute(new Uint16Array(buf.indices), 1));

      const material = createRiverWaterMaterial();
      material.userData.waterBaseColor = (material.uniforms.uBaseColor.value as Color).clone();
      material.userData.waterHighlightColor = RIVER_HIGHLIGHT_COLOR.clone();

      const mesh = new Mesh(geometry, material);
      mesh.name = `rivers-ord-${ord}`;
      mesh.renderOrder = 20;
      mesh.frustumCulled = false;
      group.add(mesh);
    }

    return group;
  }

  // ─── Internals ─────────────────────────────────────────────────

  private async fetchAndBuild(
    x: number,
    z: number
  ): Promise<RiverChunkHandle | null> {
    if (!this.manifest) await this.loadManifest();
    const url = `${this.baseUrl}/${x}_${z}.json`;
    const resp = await fetch(url);
    if (resp.status === 404) return null;
    if (!resp.ok) {
      throw new Error(`river chunk ${x},${z} HTTP ${resp.status}`);
    }
    const data = (await resp.json()) as RiverChunkData;
    const group = this.buildRiverGroup(data);
    return { group, chunkX: x, chunkZ: z, polylineCount: data.polylineCount };
  }

  private getCandidateIndex(): Map<number, RiverManifest["chunks"]> {
    if (this.candidateIndex) return this.candidateIndex;
    const index = new Map<number, RiverManifest["chunks"]>();
    for (const entry of this.manifest?.chunks ?? []) {
      const row = index.get(entry.z);
      if (row) row.push(entry);
      else index.set(entry.z, [entry]);
    }
    for (const row of index.values()) row.sort((a, b) => a.x - b.x);
    this.candidateIndex = index;
    return index;
  }
}

export function updateRiverGroupShimmer(group: Group, time: number): void {
  group.traverse((obj) => {
    const mesh = obj as Mesh;
    const material = mesh.material as RiverWaterMaterial | undefined;
    if (!material?.uniforms?.uTime) return;
    updateRiverWaterTime(material, time);
  });
}
