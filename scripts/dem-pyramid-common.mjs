// dem-pyramid-common.mjs
//
// 共享 helpers for P1 build-dem-pyramid.mjs:
//   - tier params (cell 精度, chunk size, etc.)
//   - chunk grid math (chunk(x,z) ↔ geographic bounds)
//   - FABDEM tile lookup (which tiles cover a chunk)
//   - 二进制 chunk format encode/decode (Float16)
//
// 单源 invariant: 所有 tier 都从 FABDEM raw 派生；同 projection (strict-geographic)。

import path from "node:path";
import fs from "node:fs/promises";
import { chinaBounds, parseFabdemTileName, workspacePath } from "./china-dem-common.mjs";

// ─── Tier params ─────────────────────────────────────────────────

// L0 cell 大小 (degrees): 450m at equator ≈ 0.004046°
// 实际 cell 大小随 lat 变化（地球曲率），但 chunk 用 geographic grid 等角度划分
//   — 因为整套数据都是 strict-geographic projection，无需变形
//   — 渲染时 world 坐标 由 projection 系统映射 (qinlingSlice.ts 等)
//
// 选 0.00405° per cell at L0: 256 cells × 0.00405 = 1.0368° per chunk → 一个 chunk 略大于 1°
// 这跟 FABDEM tile 1° 边界对齐——简化重采样
// 实际更直观：直接选 chunk size = 1.024° at L0 (close to 1°, 256 cells × 0.004°)

// chunkSizeDeg 必须是整数, 跟 FABDEM tile 1°×1° 边界对齐!
// 之前 1.024 (=256×0.004) 故意整数 cell deg, 但 chunk grid 跟 FABDEM tile 错位
// 累积 → 用户看到 "陡崖条带". 改 1.0 后 cell_meters = 433m (vs 之前 444m, 差 4%)
export const TIER_PARAMS = {
  L0: { tier: 0, cellsPerChunk: 256, chunkSizeDeg: 1.0 },
  L1: { tier: 1, cellsPerChunk: 256, chunkSizeDeg: 2.0 },
  L2: { tier: 2, cellsPerChunk: 256, chunkSizeDeg: 4.0 },
  L3: { tier: 3, cellsPerChunk: 256, chunkSizeDeg: 8.0 },
  L4: { tier: 4, cellsPerChunk: 256, chunkSizeDeg: 16.0 }
};

export const TIER_NAMES = ["L0", "L1", "L2", "L3", "L4"];

export function cellDegAtTier(tierName) {
  const p = TIER_PARAMS[tierName];
  return p.chunkSizeDeg / p.cellsPerChunk;
}

export function cellMetersAtTier(tierName) {
  // 大致换算: 1° lat ≈ 111 km
  return cellDegAtTier(tierName) * 111000;
}

// ─── Chunk grid math ─────────────────────────────────────────────

// chunk(x, z) at tier covers a square geographic region.
// Origin (0,0) at NW corner of china bounds (west=73°, north=53°)
// x grows east, z grows south.

export function chunkBoundsAt(tierName, chunkX, chunkZ) {
  const size = TIER_PARAMS[tierName].chunkSizeDeg;
  const west = chinaBounds.west + chunkX * size;
  const east = west + size;
  const north = chinaBounds.north - chunkZ * size;
  const south = north - size;
  return { west, east, north, south };
}

// Returns { xMin, xMax, zMin, zMax } chunk grid range covering china bounds
export function chunkGridRangeAt(tierName) {
  const size = TIER_PARAMS[tierName].chunkSizeDeg;
  const xMax = Math.ceil((chinaBounds.east - chinaBounds.west) / size) - 1;
  const zMax = Math.ceil((chinaBounds.north - chinaBounds.south) / size) - 1;
  return { xMin: 0, xMax, zMin: 0, zMax };
}

export function totalChunksAt(tierName) {
  const r = chunkGridRangeAt(tierName);
  return (r.xMax - r.xMin + 1) * (r.zMax - r.zMin + 1);
}

// ─── FABDEM tile lookup ──────────────────────────────────────────

let _tileIndex = null;

export async function loadFabdemTileIndex(tilesDir = workspacePath("data", "fabdem")) {
  if (_tileIndex) return _tileIndex;

  // Scan all tiles (china/tiles + qinling/tiles + qinling/recovery-local + recovery)
  const tiles = [];
  const dirs = [
    path.join(tilesDir, "china", "tiles"),
    path.join(tilesDir, "qinling", "tiles"),
    path.join(tilesDir, "qinling", "recovery-local"),
    path.join(tilesDir, "qinling", "recovery")
  ];
  const seen = new Set();
  for (const dir of dirs) {
    try {
      const files = await fs.readdir(dir);
      for (const f of files) {
        if (!f.endsWith("_FABDEM_V1-2.tif")) continue;
        if (seen.has(f)) continue;
        seen.add(f);
        const meta = parseFabdemTileName(f);
        if (!meta) continue;
        tiles.push({ name: f, path: path.join(dir, f), ...meta });
      }
    } catch {
      // 目录不存在，跳过
    }
  }
  _tileIndex = tiles;
  return tiles;
}

// Returns FABDEM tiles whose bounds overlap the chunk
export function tilesCoveringChunk(tiles, chunkBounds) {
  return tiles.filter((t) => {
    return !(
      t.east <= chunkBounds.west ||
      t.west >= chunkBounds.east ||
      t.north <= chunkBounds.south ||
      t.south >= chunkBounds.north
    );
  });
}

// ─── Float16 encoding ────────────────────────────────────────────
//
// JavaScript 无 native Float16Array (Node 23+ 才有)。
// 自己实现 float32 → float16 编码（IEEE 754 binary16）。
// 范围: ±65504, 精度 ~3 位有效数字 — 对 DEM elevation (米) 足够。
// NaN → 0x7E00

export function float32ToFloat16(value) {
  if (!Number.isFinite(value)) {
    return isNaN(value) ? 0x7e00 : value > 0 ? 0x7c00 : 0xfc00;
  }
  if (value === 0) return 0;

  const f32 = new Float32Array(1);
  const u32 = new Uint32Array(f32.buffer);
  f32[0] = value;
  const bits = u32[0];

  const sign = (bits >> 31) & 0x1;
  let exp = (bits >> 23) & 0xff;
  let mant = bits & 0x7fffff;

  if (exp === 0xff) {
    // inf / nan handled above
    return sign << 15 | 0x7c00 | (mant ? 0x200 : 0);
  }

  // Re-bias exponent: 127 → 15
  exp = exp - 127 + 15;
  if (exp <= 0) {
    // Subnormal or underflow → 0
    return sign << 15;
  }
  if (exp >= 0x1f) {
    // Overflow → inf
    return (sign << 15) | 0x7c00;
  }

  // Round mantissa to 10 bits
  mant = mant >> 13;
  return (sign << 15) | (exp << 10) | mant;
}

// ─── Chunk binary format ─────────────────────────────────────────
//
// Header (8 bytes):
//   uint16 magic = 0xDEAD (little-endian)
//   uint8  version = 1
//   uint8  tier (0-4)
//   uint16 chunkX
//   uint16 chunkZ
//
// Data:
//   uint16 × 256 × 256 = 131072 bytes (Float16 little-endian)

const HEADER_SIZE = 8;
const MAGIC = 0xdead;
const VERSION = 1;

export function encodeChunkBinary({ tier, chunkX, chunkZ, heights }) {
  const cellsPerChunk = TIER_PARAMS[`L${tier}`].cellsPerChunk;
  const expectedSize = cellsPerChunk * cellsPerChunk;
  if (heights.length !== expectedSize) {
    throw new Error(
      `encodeChunkBinary: heights.length=${heights.length} != ${expectedSize} for L${tier}`
    );
  }

  const buffer = new ArrayBuffer(HEADER_SIZE + expectedSize * 2);
  const view = new DataView(buffer);

  // Header
  view.setUint16(0, MAGIC, true);
  view.setUint8(2, VERSION);
  view.setUint8(3, tier);
  view.setUint16(4, chunkX, true);
  view.setUint16(6, chunkZ, true);

  // Data (Float16 little-endian)
  for (let i = 0; i < expectedSize; i += 1) {
    const f16 = float32ToFloat16(heights[i]);
    view.setUint16(HEADER_SIZE + i * 2, f16, true);
  }

  return Buffer.from(buffer);
}

// ─── Output paths ────────────────────────────────────────────────

export function pyramidOutputDir() {
  return workspacePath("public", "data", "dem");
}

export function chunkOutputPath(tierName, chunkX, chunkZ) {
  return path.join(pyramidOutputDir(), tierName, `${chunkX}_${chunkZ}.bin`);
}

export function manifestOutputPath() {
  return path.join(pyramidOutputDir(), "manifest.json");
}
