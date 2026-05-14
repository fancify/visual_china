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
  CatmullRomCurve3,
  Color,
  Group,
  Vector3
} from "three";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { projectGeoToWorld, unprojectWorldToGeo } from "../mapOrientation.js";
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
  RIVER_WATER_COLOR,
  RIVER_WATER_OPACITY,
  RIVER_WATER_SHIMMER
} from "./waterStyle.js";

// 用 Three.js Line2 (fat lines) — 屏幕空间 anti-aliased polylines, 恒定像素宽度
// 不管相机距离, 永远不出 ribbon-quad facet 缺陷 (image 10-14 那些 bubble/fragment).
// 真正干净的 cartographic 河, 跟 BotW 不一样 — BotW 用 3D 水面 shader, 不是线.
//
// 资源: three/examples/jsm/lines/{Line2, LineGeometry, LineMaterial}

const Y_OFFSET = 0.08; // 河流浮于 DEM 表面 z-fight 缓冲
const SPLINE_SUBDIV = 5; // 每 source segment 插 5 点 — 平滑曲线 (Line2 没 quad 问题)
const RIVER_HIGHLIGHT_COLOR = new Color(0x7fa1a6);
const SHORE_CLIP_ITERATIONS = 8;

// Linewidth in world units (worldUnits: true) — 真实物理宽度, 远看自然变细近看变粗:
//   ord 8+ 干流 (长江/黄河):  0.9u  (~ 3km, 跟真实长江中下游 1-3km 对齐)
//   ord 7 (大支流):           0.5u
//   ord 6:                    0.3u
//   ord 5:                    0.18u
//   ord 4:                    0.10u
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

    // Group polylines by ord (each ord 一 shared LineMaterial)
    const byOrd = new Map<number, RiverPolyline[]>();
    for (const p of data.polylines) {
      if (p.ord < this.minOrder) continue;
      const list = byOrd.get(p.ord) ?? [];
      list.push(p);
      byOrd.set(p.ord, list);
    }

    // 同 ord 所有 polylines 合并到一个 LineSegments2 — 一个 draw call 渲全 chunk 同色河
    for (const [ord, polylines] of byOrd) {
      const linewidth = widthForOrd(ord);
      const material = new LineMaterial({
        color: RIVER_WATER_COLOR.getHex(),
        linewidth,
        transparent: true,
        opacity: RIVER_WATER_OPACITY,
        depthWrite: false,
        worldUnits: true
      });
      material.resolution.set(
        typeof window !== "undefined" ? window.innerWidth : 1920,
        typeof window !== "undefined" ? window.innerHeight : 1080
      );
      material.userData.waterBaseColor = RIVER_WATER_COLOR.clone();
      material.userData.waterBaseOpacity = RIVER_WATER_OPACITY;
      material.userData.waterShimmerStrength = RIVER_WATER_SHIMMER;
      material.userData.waterPhase = ord * 0.73;

      // 抽所有 polylines 的 segments (LineSegmentsGeometry 要 [a,b, c,d, ...] 段对)
      const allSegments: number[] = [];
      for (const poly of polylines) {
        appendPolylineSegments(poly, this.sampler, allSegments, {
          landMaskSampler: this.landMaskSampler,
          excludeWaterSampler: this.excludeWaterSampler
        });
      }
      if (allSegments.length === 0) continue;

      const geometry = new LineSegmentsGeometry();
      geometry.setPositions(allSegments);
      const lines = new LineSegments2(geometry, material);
      lines.computeLineDistances();
      lines.renderOrder = 20;
      lines.name = `rivers-ord-${ord}`;
      group.add(lines);
    }

    return group;
  }
}

export function updateRiverGroupShimmer(group: Group, time: number): void {
  group.traverse((obj) => {
    const material = (obj as LineSegments2).material as LineMaterial | undefined;
    const baseColor = material?.userData.waterBaseColor as Color | undefined;
    const baseOpacity = material?.userData.waterBaseOpacity as number | undefined;
    const shimmerStrength =
      (material?.userData.waterShimmerStrength as number | undefined) ?? RIVER_WATER_SHIMMER;
    if (!material || !baseColor || baseOpacity === undefined) return;

    const phase = (material.userData.waterPhase as number | undefined) ?? 0;
    const shimmer = 0.5 + 0.5 * Math.sin(time * 0.85 + phase);
    material.color.copy(baseColor).lerp(RIVER_HIGHLIGHT_COLOR, shimmer * shimmerStrength);
    material.opacity = Math.min(1, baseOpacity * (0.98 + shimmer * 0.02));
    material.needsUpdate = true;
  });
}

// ─── Segment-pair appender for LineSegmentsGeometry batching ──────

function appendPolylineSegments(
  poly: RiverPolyline,
  sampler: PyramidSampler,
  out: number[],
  masks: {
    landMaskSampler?: LandMaskSampler | null;
    excludeWaterSampler?: LakeMaskSampler | null;
  } = {}
): void {
  if (poly.coords.length < 2) return;

  // 1. lon/lat → world XZ
  const sourceXZ: Vector3[] = poly.coords.map(([lon, lat]) => {
    const w = projectGeoToWorld({ lat, lon }, qinlingRegionBounds, qinlingRegionWorld);
    return new Vector3(w.x, 0, w.z);
  });

  // 2. Catmull-Rom 平滑
  let smoothed: Vector3[];
  if (sourceXZ.length >= 2) {
    const curve = new CatmullRomCurve3(sourceXZ, false, "centripetal", 0.5);
    const totalPts = Math.max(4, sourceXZ.length * SPLINE_SUBDIV);
    smoothed = curve.getPoints(totalPts);
  } else {
    smoothed = sourceXZ;
  }
  if (smoothed.length < 2) return;

  // 3. Y sample + moving-avg smooth
  const rawY: number[] = smoothed.map((p) => {
    const y = sampler.sampleHeightWorld(p.x, p.z);
    return Number.isFinite(y) ? y : NaN;
  });
  for (let i = 0; i < rawY.length; i += 1) {
    if (!Number.isFinite(rawY[i])) {
      let prev = i - 1;
      while (prev >= 0 && !Number.isFinite(rawY[prev])) prev -= 1;
      let next = i + 1;
      while (next < rawY.length && !Number.isFinite(rawY[next])) next += 1;
      if (prev >= 0 && next < rawY.length) rawY[i] = (rawY[prev] + rawY[next]) / 2;
      else if (prev >= 0) rawY[i] = rawY[prev];
      else if (next < rawY.length) rawY[i] = rawY[next];
      else rawY[i] = 0;
    }
  }
  const SMOOTH_K = 7;
  const half = Math.floor(SMOOTH_K / 2);
  const smoothY: number[] = new Array(rawY.length);
  for (let i = 0; i < rawY.length; i += 1) {
    let s = 0;
    let n = 0;
    for (let k = -half; k <= half; k += 1) {
      const j = Math.max(0, Math.min(rawY.length - 1, i + k));
      s += rawY[j];
      n += 1;
    }
    smoothY[i] = s / n;
  }

  // 4. 写 segment pairs [a.x,a.y,a.z, b.x,b.y,b.z, b.x,b.y,b.z, c.x,c.y,c.z, ...]
  for (let i = 0; i < smoothed.length - 1; i += 1) {
    const a = smoothed[i];
    const b = smoothed[i + 1];
    let ax = a.x;
    let az = a.z;
    let ay = smoothY[i];
    let bx = b.x;
    let bz = b.z;
    let by = smoothY[i + 1];

    if (masks.landMaskSampler) {
      const geoA = unprojectWorldToGeo({ x: ax, z: az }, qinlingRegionBounds, qinlingRegionWorld);
      const geoB = unprojectWorldToGeo({ x: bx, z: bz }, qinlingRegionBounds, qinlingRegionWorld);
      const landA = masks.landMaskSampler.isLand(geoA.lon, geoA.lat);
      const landB = masks.landMaskSampler.isLand(geoB.lon, geoB.lat);
      if (!landA && !landB) continue;
      if (landA !== landB) {
        const t = findShoreClipT(
          masks.landMaskSampler,
          ax,
          az,
          landA,
          bx,
          bz,
          landB
        );
        const sx = ax + (bx - ax) * t;
        const sz = az + (bz - az) * t;
        const sy = ay + (by - ay) * t;
        if (landA) {
          bx = sx;
          bz = sz;
          by = sy;
        } else {
          ax = sx;
          az = sz;
          ay = sy;
        }
      }
    }

    const mid = {
      x: (ax + bx) / 2,
      z: (az + bz) / 2
    };
    const geo = unprojectWorldToGeo(mid, qinlingRegionBounds, qinlingRegionWorld);
    if (masks.landMaskSampler && !masks.landMaskSampler.isLand(geo.lon, geo.lat)) {
      continue;
    }
    if (masks.excludeWaterSampler?.isWater(geo.lon, geo.lat)) {
      continue;
    }
    out.push(ax, ay + Y_OFFSET, az);
    out.push(bx, by + Y_OFFSET, bz);
  }
}

function findShoreClipT(
  sampler: LandMaskSampler,
  ax: number,
  az: number,
  landA: boolean,
  bx: number,
  bz: number,
  _landB: boolean
): number {
  let tLow = landA ? 0 : 1;
  let tHigh = landA ? 1 : 0;
  for (let i = 0; i < SHORE_CLIP_ITERATIONS; i += 1) {
    const tMid = (tLow + tHigh) / 2;
    const x = ax + (bx - ax) * tMid;
    const z = az + (bz - az) * tMid;
    const geo = unprojectWorldToGeo({ x, z }, qinlingRegionBounds, qinlingRegionWorld);
    if (sampler.isLand(geo.lon, geo.lat)) tLow = tMid;
    else tHigh = tMid;
  }
  return (tLow + tHigh) / 2;
}
