// terrain/pyramidDecode.ts — Float16 binary chunk 解码
//
// Format: dem-pyramid-common.mjs encodeChunkBinary
//   Header (8 bytes):
//     uint16 magic = 0xDEAD (little-endian)
//     uint8  version: 1 = no ghost ring (N²), 2 = 1-cell ghost ring ((N+2)²)
//     uint8  tier (0-4)
//     uint16 chunkX
//     uint16 chunkZ
//   Data:
//     v1: uint16 × N × N (Float16 little-endian)
//     v2: uint16 × (N+2) × (N+2)  — outermost ring is ghost samples from neighbor space
//   NaN-encoded as 0x7E00 in both versions.

const MAGIC = 0xdead;

// 由 tier 推 mesh side N. 跟 TIER_PARAMS.cellsPerChunk 对齐.
const MESH_SIDE_BY_TIER: Record<number, number> = {
  0: 256,
  1: 256,
  2: 256,
  3: 256,
  4: 256
};

export function float16ToFloat32(h: number): number {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7c00) >> 10;
  const f = h & 0x03ff;
  if (e === 0) return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
  if (e === 0x1f) return f ? NaN : s ? -Infinity : Infinity;
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
}

export interface DecodedChunk {
  tier: number;
  chunkX: number;
  chunkZ: number;
  heights: Float32Array;
  /** Mesh vertices per side (256 for all L0-L4). */
  cellsPerChunk: number;
  /** 0 = no ghost ring (v1); 1 = 1-cell ghost ring (v2). heights.length = (cellsPerChunk + 2*ghostWidth)². */
  ghostWidth: number;
}

export function decodePyramidChunk(buffer: ArrayBuffer): DecodedChunk {
  const view = new DataView(buffer);
  const magic = view.getUint16(0, true);
  if (magic !== MAGIC) {
    throw new Error(`bad magic 0x${magic.toString(16)} (expected 0xdead)`);
  }
  const version = view.getUint8(2);
  if (version !== 1 && version !== 2) {
    throw new Error(`unknown pyramid chunk version ${version}`);
  }
  const tier = view.getUint8(3);
  const chunkX = view.getUint16(4, true);
  const chunkZ = view.getUint16(6, true);

  const dataBytes = buffer.byteLength - 8;
  const cellCount = dataBytes / 2;
  const arraySide = Math.round(Math.sqrt(cellCount));
  if (arraySide * arraySide !== cellCount) {
    throw new Error(`chunk data not square: ${cellCount} cells`);
  }

  const cellsPerChunk = MESH_SIDE_BY_TIER[tier] ?? arraySide;
  const ghostWidth = version === 2 ? 1 : 0;
  const expectedSide = cellsPerChunk + 2 * ghostWidth;
  if (arraySide !== expectedSide) {
    throw new Error(
      `chunk size mismatch: array side ${arraySide}, expected ${expectedSide} (mesh=${cellsPerChunk}, ghost=${ghostWidth})`
    );
  }

  const heights = new Float32Array(cellCount);
  for (let i = 0; i < cellCount; i += 1) {
    const f16 = view.getUint16(8 + i * 2, true);
    heights[i] = float16ToFloat32(f16);
  }

  return { tier, chunkX, chunkZ, heights, cellsPerChunk, ghostWidth };
}
