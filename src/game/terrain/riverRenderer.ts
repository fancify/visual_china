// terrain/riverRenderer.ts —
//
// 把 P2 生成的 per-chunk rivers polyline 数据渲染成 ribbon mesh.
// 每 chunk 一个 Group：所有 polyline 合并成一个 BufferGeometry (节省 draw call)。
//
// Width 由 ORD_STRA 决定:
//   ord 3 (小支流):   0.05 world units
//   ord 4 (中支流):   0.10
//   ord 5 (大支流):   0.18
//   ord 6+ (干流):    0.30 - 0.50
//
// Y 由 PyramidSampler 查询 — 河流贴 mesh 表面 + 微小 offset 避免 z-fight
//
// 数据流:
//   manifest.json (./data/rivers/manifest.json) — 一次加载
//   各 chunk JSON — lazy fetch (跟 DEM chunk 同步加载)

import {
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  Vector3
} from "three";
import { projectGeoToWorld } from "../mapOrientation.js";
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

const Y_OFFSET = 0.12; // 河流浮于 DEM 表面，避免 z-fight；调大可见
const WATER_COLOR = new Color(0.22, 0.42, 0.55); // 偏深蓝绿，跟陆地色对比

// 调大 width — 当前 verticalScale=180 下原来 0.05u 太细看不见
function widthForOrd(ord: number): number {
  if (ord >= 8) return 2.0;
  if (ord >= 7) return 1.5;
  if (ord >= 6) return 1.0;
  if (ord >= 5) return 0.6;
  if (ord >= 4) return 0.35;
  return 0.2; // ord 3
}

export interface RiverLoaderOptions {
  baseUrl?: string;
  sampler: PyramidSampler;
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

  private manifest: RiverManifest | null = null;
  private manifestPromise: Promise<RiverManifest> | null = null;
  private chunkCache = new Map<string, RiverChunkHandle>();
  private inflightFetches = new Map<string, Promise<RiverChunkHandle | null>>();

  constructor(opts: RiverLoaderOptions) {
    this.baseUrl = opts.baseUrl ?? "/data/rivers";
    this.sampler = opts.sampler;
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
    const out: { x: number; z: number }[] = [];
    for (const entry of this.manifest.chunks) {
      if (
        Math.abs(entry.x - centerX) <= radius &&
        Math.abs(entry.z - centerZ) <= radius
      ) {
        out.push({ x: entry.x, z: entry.z });
      }
    }
    return out;
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

  private buildRiverGroup(data: RiverChunkData): Group {
    const group = new Group();
    group.name = `rivers-${data.chunkX}-${data.chunkZ}`;

    // Bucket polylines by ord (so each ord gets one merged mesh with appropriate width)
    const byOrd = new Map<number, RiverPolyline[]>();
    for (const p of data.polylines) {
      const list = byOrd.get(p.ord) ?? [];
      list.push(p);
      byOrd.set(p.ord, list);
    }

    for (const [ord, polylines] of byOrd) {
      const width = widthForOrd(ord);
      const geometry = buildRibbonGeometry(polylines, width, this.sampler);
      if (geometry === null) continue;
      const material = new MeshBasicMaterial({
        color: WATER_COLOR,
        transparent: true,
        opacity: 0.85,
        depthWrite: false
      });
      const mesh = new Mesh(geometry, material);
      mesh.renderOrder = 20; // above terrain
      mesh.name = `rivers-ord-${ord}`;
      group.add(mesh);
    }

    return group;
  }
}

// ─── Ribbon geometry builder ────────────────────────────────────

function buildRibbonGeometry(
  polylines: RiverPolyline[],
  width: number,
  sampler: PyramidSampler
): BufferGeometry | null {
  // For each polyline, build a strip: two parallel rows of vertices
  // perpendicular to local direction. Triangles connect them.
  const positions: number[] = [];
  const indices: number[] = [];
  let baseIdx = 0;

  for (const poly of polylines) {
    if (poly.coords.length < 2) continue;

    // 1. Project each lon/lat to world (x, z); sample Y from DEM
    const worldPoints: Vector3[] = [];
    for (const [lon, lat] of poly.coords) {
      const w = projectGeoToWorld(
        { lat, lon },
        qinlingRegionBounds,
        qinlingRegionWorld
      );
      const y = sampler.sampleHeightWorld(w.x, w.z);
      const finalY = Number.isFinite(y) ? y + Y_OFFSET : Y_OFFSET;
      worldPoints.push(new Vector3(w.x, finalY, w.z));
    }
    if (worldPoints.length < 2) continue;

    // 2. For each segment, compute perpendicular direction; emit 2 quad vertices
    for (let i = 0; i < worldPoints.length; i += 1) {
      const p = worldPoints[i];
      // Local tangent direction = avg of (i-1 → i) and (i → i+1)
      let tx = 0;
      let tz = 0;
      if (i > 0) {
        tx += p.x - worldPoints[i - 1].x;
        tz += p.z - worldPoints[i - 1].z;
      }
      if (i < worldPoints.length - 1) {
        tx += worldPoints[i + 1].x - p.x;
        tz += worldPoints[i + 1].z - p.z;
      }
      const tlen = Math.sqrt(tx * tx + tz * tz) || 1;
      tx /= tlen;
      tz /= tlen;
      // Perpendicular (in xz plane): rotate 90° → (-tz, tx)
      const px = -tz;
      const pz = tx;

      // Two parallel vertices, ± width/2 perpendicular
      const halfW = width * 0.5;
      positions.push(p.x + px * halfW, p.y, p.z + pz * halfW);
      positions.push(p.x - px * halfW, p.y, p.z - pz * halfW);
    }

    // 3. Triangles connecting adjacent vertex pairs
    const segCount = worldPoints.length;
    for (let i = 0; i < segCount - 1; i += 1) {
      const v0 = baseIdx + i * 2;
      const v1 = v0 + 1;
      const v2 = v0 + 2;
      const v3 = v0 + 3;
      indices.push(v0, v2, v1);
      indices.push(v1, v2, v3);
    }
    baseIdx += segCount * 2;
  }

  if (positions.length === 0) return null;
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(positions), 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
