// terrain/pyramidTypes.ts — P3 新 renderer 的核心类型
//
// 数据契约: matches `public/data/dem/manifest.json` (build-dem-pyramid.mjs 输出)
// 和 `public/data/rivers/manifest.json` (build-rivers-chunked.mjs 输出)。

export type TierName = "L0" | "L1" | "L2" | "L3" | "L4";

export interface PyramidTierMeta {
  /** numeric tier index 0..4 */
  tier: number;
  /** 256 (每 chunk 一边的 cell 数) */
  cellsPerChunk: number;
  /** 1.0, 2.0, 4.0, 8.0, 16.0 度 — 必整数, 跟 FABDEM tile 边界对齐 */
  chunkSizeDeg: number;
  /** ~433, 866, 1735, 3469, 6937 米 (1° / 256) */
  cellMeters: number;
  /** 实际 chunk 数 */
  chunkCount: number;
  /** [min, max] 范围 */
  chunkRangeX: [number, number];
  chunkRangeZ: [number, number];
}

export interface PyramidManifest {
  schemaVersion: "visual-china.dem-pyramid.v1";
  generatedAt: string;
  generator: string;
  source: string;
  bounds: {
    west: number;
    east: number;
    south: number;
    north: number;
  };
  projection: "strict-geographic";
  tiers: Record<TierName, PyramidTierMeta>;
}

// ─── Loaded chunk ────────────────────────────────────────────────

export interface LoadedChunk {
  tier: TierName;
  /** chunk integer coords; (0,0) at NW */
  chunkX: number;
  chunkZ: number;
  /** geographic bounds covered by this chunk */
  bounds: { west: number; east: number; north: number; south: number };
  /** N×N Float32 heights, NaN for missing cells */
  heights: Float32Array;
  cellsPerChunk: number;
  /** for LRU cache eviction */
  lastUsed: number;
}

// ─── Rivers (per-chunk overlay) ─────────────────────────────────

export interface RiverPolyline {
  id: number;
  /** ORD_STRA stream order 1-12 (we filter to >= 3) */
  ord: number;
  /** discharge average m³/s (may be 0 if unknown) */
  flow: number;
  /** [lon, lat][] */
  coords: [number, number][];
}

export interface RiverChunkData {
  schemaVersion: "visual-china.rivers-chunk.v1";
  chunkX: number;
  chunkZ: number;
  bounds: { west: number; east: number; north: number; south: number };
  minOrder: number;
  polylineCount: number;
  polylines: RiverPolyline[];
}

export interface RiverManifestEntry {
  x: number;
  z: number;
  file: string;
  count: number;
}

export interface RiverManifest {
  schemaVersion: "visual-china.rivers-pyramid.v1";
  generatedAt: string;
  bounds: { west: number; east: number; south: number; north: number };
  minOrder: number;
  tierGrid: "L0";
  totalPolylines: number;
  chunkCount: number;
  chunks: RiverManifestEntry[];
}
