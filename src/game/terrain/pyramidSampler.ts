// terrain/pyramidSampler.ts — query pyramid 取 height at world (x, z)
//
// 给 SurfaceProvider impl 用：把世界坐标转成 geo (lon,lat) → 找对应 chunk →
// bilinear 取高度。
//
// 复用现有 mapOrientation API。
//
// 关键设计:
//   - 优先用 L0 (450m)；fallback 到 L1/L2 如果 L0 chunk 没 load
//   - bilinear interpolation 在 chunk 内 cell 网格
//   - NaN 处理：返回 sea level (0) 或 user-supplied fallback

import { projectGeoToWorld, unprojectWorldToGeo } from "../mapOrientation.js";
import { qinlingRegionBounds, qinlingRegionWorld } from "../../data/qinlingRegion.js";
import { PyramidLoader } from "./pyramidLoader.js";
import type {
  LoadedChunk,
  PyramidManifest,
  TierName
} from "./pyramidTypes.js";

const VERTICAL_EXAGGERATION = 1.07; // 跟 pyramidMesh.ts 同步
const SEA_LEVEL = 0;

export interface PyramidSamplerOptions {
  loader: PyramidLoader;
  /** 单位换算 elevation(m) → world unit。默认: 项目惯例 1u ≈ 3.275km，
   *  vertical scale 1u = 110m elevation (跟之前 chunks 数值匹配)。
   *  最终 world Y = (elevation_m / 110) * VERTICAL_EXAGGERATION */
  verticalScale?: number;
}

// 跟 pyramidMesh.ts VERTICAL_SCALE 同步, 保 sampler 物理 Y 跟视觉 Y 一致
const DEFAULT_VERTICAL_SCALE = 500;

export class PyramidSampler {
  readonly loader: PyramidLoader;
  readonly verticalScale: number;
  private manifestRef: PyramidManifest | null = null;

  constructor(opts: PyramidSamplerOptions) {
    this.loader = opts.loader;
    this.verticalScale = opts.verticalScale ?? DEFAULT_VERTICAL_SCALE;
  }

  setManifest(m: PyramidManifest): void {
    this.manifestRef = m;
  }

  /**
   * Sample height at world (x, z). Returns world-unit Y.
   * If chunk not loaded yet, fires async fetch and returns NaN.
   * Caller (PyramidSurfaceProvider) uses last-known value during async.
   */
  sampleHeightWorld(x: number, z: number): number {
    const elev = this.sampleElevationMetersWorld(x, z);
    if (!Number.isFinite(elev)) return SEA_LEVEL;
    return (elev / this.verticalScale) * VERTICAL_EXAGGERATION;
  }

  /** Sample height without triggering async chunk loads. Useful for broad overlays. */
  sampleHeightWorldCached(x: number, z: number): number {
    const elev = this.sampleElevationMetersWorldCached(x, z);
    if (!Number.isFinite(elev)) return SEA_LEVEL;
    return (elev / this.verticalScale) * VERTICAL_EXAGGERATION;
  }

  /** Sample raw elevation (meters) at world (x, z). NaN if no data. */
  sampleElevationMetersWorld(x: number, z: number): number {
    const geo = unprojectWorldToGeo(
      { x, z },
      qinlingRegionBounds,
      qinlingRegionWorld
    );
    return this.sampleElevationMetersGeoInternal(geo.lon, geo.lat, true);
  }

  /** Sample raw elevation without triggering async chunk loads. */
  sampleElevationMetersWorldCached(x: number, z: number): number {
    const geo = unprojectWorldToGeo(
      { x, z },
      qinlingRegionBounds,
      qinlingRegionWorld
    );
    return this.sampleElevationMetersGeoInternal(geo.lon, geo.lat, false);
  }

  /** Sample at lon/lat directly. */
  sampleElevationMetersGeo(lon: number, lat: number): number {
    return this.sampleElevationMetersGeoInternal(lon, lat, true);
  }

  private sampleElevationMetersGeoInternal(
    lon: number,
    lat: number,
    requestMissingChunks: boolean
  ): number {
    if (!this.manifestRef) return NaN;

    // Try L0 first, walk up tiers if not available
    for (const tier of ["L0", "L1", "L2", "L3", "L4"] as TierName[]) {
      const tierMeta = this.manifestRef.tiers[tier];
      if (!tierMeta) continue;
      const size = tierMeta.chunkSizeDeg;
      const chunkX = Math.floor((lon - this.manifestRef.bounds.west) / size);
      const chunkZ = Math.floor((this.manifestRef.bounds.north - lat) / size);
      const chunk = this.loader.getCachedChunk(tier, chunkX, chunkZ);
      if (!chunk) {
        // fire async load (don't await)
        if (requestMissingChunks) void this.loader.requestChunk(tier, chunkX, chunkZ);
        continue;
      }
      const v = sampleChunkBilinear(chunk, lon, lat);
      if (Number.isFinite(v)) return v;
    }
    return NaN;
  }
}

// Bilinear interpolation within a chunk
function sampleChunkBilinear(
  chunk: LoadedChunk,
  lon: number,
  lat: number
): number {
  const { bounds, cellsPerChunk, heights, ghostWidth: gw0 } = chunk;
  const ghostWidth = gw0 ?? 0;
  // 数组真实边长 (含 ghost ring), 用于 stride 索引
  const arraySide = cellsPerChunk + 2 * ghostWidth;
  // u = column fraction (0=west, 1=east), v = row fraction (0=north, 1=south)
  const u = (lon - bounds.west) / (bounds.east - bounds.west);
  const v = (bounds.north - lat) / (bounds.north - bounds.south);
  if (u < 0 || u > 1 || v < 0 || v > 1) return NaN;

  const colF = u * (cellsPerChunk - 1);
  const rowF = v * (cellsPerChunk - 1);
  const c0 = Math.floor(colF);
  const r0 = Math.floor(rowF);
  const c1 = Math.min(cellsPerChunk - 1, c0 + 1);
  const r1 = Math.min(cellsPerChunk - 1, r0 + 1);
  const fc = colF - c0;
  const fr = rowF - r0;

  // Mesh vertex (r, c) ∈ [0, cellsPerChunk) maps to array index (r+gw, c+gw) ∈ [gw, gw+N)
  const idx = (r: number, c: number) => (r + ghostWidth) * arraySide + (c + ghostWidth);
  const v00 = heights[idx(r0, c0)];
  const v01 = heights[idx(r0, c1)];
  const v10 = heights[idx(r1, c0)];
  const v11 = heights[idx(r1, c1)];

  // If any sample is NaN, fall back to nearest valid
  const candidates = [
    { v: v00, w: (1 - fc) * (1 - fr) },
    { v: v01, w: fc * (1 - fr) },
    { v: v10, w: (1 - fc) * fr },
    { v: v11, w: fc * fr }
  ];
  let sum = 0;
  let wSum = 0;
  for (const { v, w } of candidates) {
    if (Number.isFinite(v) && w > 0) {
      sum += v * w;
      wSum += w;
    }
  }
  if (wSum === 0) return NaN;
  return sum / wSum;
}
