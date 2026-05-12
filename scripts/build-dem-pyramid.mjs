// build-dem-pyramid.mjs
//
// 从 FABDEM raw (984 个 30m tile) 烤 L0-L4 5-tier multi-LOD pyramid
//
// 用法:
//   node scripts/build-dem-pyramid.mjs                         # 默认 L0-L3 全图
//   node scripts/build-dem-pyramid.mjs --tier=L0               # 只烤 L0
//   node scripts/build-dem-pyramid.mjs --tier=L0,L1,L2,L3      # 指定 tier 集合
//   node scripts/build-dem-pyramid.mjs --bbox=73,18,90,40      # 限定 bbox 测试
//   node scripts/build-dem-pyramid.mjs --concurrency=8         # 并发 (默认 = CPU 数)
//   node scripts/build-dem-pyramid.mjs --dry-run               # 不烤，只算 chunk grid
//
// 输出:
//   public/data/dem/L{N}/{x}_{z}.bin       Float16 256×256 chunks
//   public/data/dem/manifest.json          全 pyramid metadata
//
// 设计文档: docs/02-architecture/p1-pyramid-design.md

import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fromFile } from "geotiff";

import { chinaBounds } from "./china-dem-common.mjs";
import {
  TIER_PARAMS,
  TIER_NAMES,
  cellDegAtTier,
  cellMetersAtTier,
  chunkBoundsAt,
  chunkGridRangeAt,
  totalChunksAt,
  loadFabdemTileIndex,
  tilesCoveringChunk,
  encodeChunkBinary,
  pyramidOutputDir,
  chunkOutputPath,
  manifestOutputPath
} from "./dem-pyramid-common.mjs";

// ─── Args parsing ───────────────────────────────────────────────

const args = process.argv.slice(2);

function getFlag(name) {
  return args.some((a) => a === `--${name}` || a === name);
}

function getOpt(name, fallback = null) {
  const found = args.find((a) => a.startsWith(`--${name}=`));
  return found ? found.split("=").slice(1).join("=") : fallback;
}

const dryRun = getFlag("dry-run");
const concurrency = Number(getOpt("concurrency", os.cpus().length));
const tiersOpt = getOpt("tier", "L0,L1,L2,L3");
const tiers = tiersOpt.split(",").map((s) => s.trim()).filter(Boolean);
const bboxOpt = getOpt("bbox", null);
const userBbox = bboxOpt
  ? (() => {
      const [w, s, e, n] = bboxOpt.split(",").map(Number);
      return { west: w, south: s, east: e, north: n };
    })()
  : chinaBounds;

const forceOverwrite = getFlag("force");

for (const t of tiers) {
  if (!TIER_PARAMS[t]) {
    console.error(`Unknown tier: ${t}. Valid: ${TIER_NAMES.join(", ")}`);
    process.exit(1);
  }
}

// ─── Print plan ─────────────────────────────────────────────────

console.log("=".repeat(60));
console.log("DEM Pyramid Builder (P1)");
console.log("=".repeat(60));
console.log(`Tiers:        ${tiers.join(", ")}`);
console.log(`Concurrency:  ${concurrency}`);
console.log(`Bbox:         ${userBbox.west}-${userBbox.east}°E × ${userBbox.south}-${userBbox.north}°N`);
console.log(`Dry-run:      ${dryRun}`);
console.log(`Force:        ${forceOverwrite}`);
console.log("");
console.log("Tier params:");
for (const t of tiers) {
  const total = totalChunksAt(t);
  const cellM = cellMetersAtTier(t);
  const chunkKm = TIER_PARAMS[t].chunkSizeDeg * 111;
  console.log(
    `  ${t}: cell≈${cellM.toFixed(0)}m, chunk=${chunkKm.toFixed(0)}km², ${total} chunks total`
  );
}
console.log("");

if (dryRun) {
  console.log("(dry-run, exiting)");
  process.exit(0);
}

// ─── Helpers ────────────────────────────────────────────────────

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

// p limit-style worker pool
async function withConcurrency(items, n, worker) {
  let idx = 0;
  let done = 0;
  const total = items.length;
  const t0 = Date.now();
  async function loop(workerId) {
    while (idx < items.length) {
      const i = idx++;
      try {
        await worker(items[i], i);
      } catch (e) {
        console.error(`worker ${workerId} item ${i}: ${e.message}`);
      }
      done += 1;
      if (done % 50 === 0 || done === total) {
        const elapsed = (Date.now() - t0) / 1000;
        const rate = done / elapsed;
        const eta = (total - done) / rate;
        console.log(
          `  ${done}/${total} (${(done / total * 100).toFixed(1)}%) ` +
            `${rate.toFixed(1)}/s ETA ${eta.toFixed(0)}s`
        );
      }
    }
  }
  await Promise.all(Array.from({ length: n }, (_, i) => loop(i)));
}

// 简单 LRU cache：tile path → loaded { image, width, height, bounds }
// 避免每 chunk 重新 fromFile 同一个 tile
class TileCache {
  constructor(maxSize = 32) {
    this.maxSize = maxSize;
    this.map = new Map();
  }
  async get(tile) {
    if (this.map.has(tile.path)) {
      const entry = this.map.get(tile.path);
      this.map.delete(tile.path);
      this.map.set(tile.path, entry); // LRU bump
      return entry;
    }
    const tiff = await fromFile(tile.path);
    const image = await tiff.getImage();
    const entry = {
      image,
      width: image.getWidth(),
      height: image.getHeight(),
      west: tile.west,
      east: tile.east,
      north: tile.north,
      south: tile.south
    };
    this.map.set(tile.path, entry);
    if (this.map.size > this.maxSize) {
      const firstKey = this.map.keys().next().value;
      this.map.delete(firstKey);
    }
    return entry;
  }
}

const tileCache = new TileCache(32);

// ─── L0 chunk 烤逻辑 ─────────────────────────────────────────────

async function bakeL0Chunk({ chunkX, chunkZ, tiles }) {
  const bounds = chunkBoundsAt("L0", chunkX, chunkZ);
  const overlapping = tilesCoveringChunk(tiles, bounds);
  if (overlapping.length === 0) {
    return null; // 海洋 / 全无覆盖
  }

  const N = TIER_PARAMS.L0.cellsPerChunk;
  const heights = new Float32Array(N * N).fill(Number.NaN);
  let hasData = false;

  for (const tile of overlapping) {
    const entry = await tileCache.get(tile);
    const { image, width, height } = entry;

    // chunk's bounds 映射到 tile's pixel space
    // tile bounds: tile.west .. tile.east (1°), tile.north .. tile.south (1°)
    // image: 3600×3600 pixels typically
    const tileWest = entry.west;
    const tileEast = entry.east;
    const tileNorth = entry.north;
    const tileSouth = entry.south;
    const tileWidthDeg = tileEast - tileWest;
    const tileHeightDeg = tileNorth - tileSouth;

    // 计算 tile 与 chunk 的重叠区域 (geo)
    const overlapWest = Math.max(bounds.west, tileWest);
    const overlapEast = Math.min(bounds.east, tileEast);
    const overlapNorth = Math.min(bounds.north, tileNorth);
    const overlapSouth = Math.max(bounds.south, tileSouth);

    // tile pixel window
    const px0 = clamp(
      Math.floor(((overlapWest - tileWest) / tileWidthDeg) * width),
      0,
      width - 1
    );
    const px1 = clamp(
      Math.ceil(((overlapEast - tileWest) / tileWidthDeg) * width),
      1,
      width
    );
    const py0 = clamp(
      Math.floor(((tileNorth - overlapNorth) / tileHeightDeg) * height),
      0,
      height - 1
    );
    const py1 = clamp(
      Math.ceil(((tileNorth - overlapSouth) / tileHeightDeg) * height),
      1,
      height
    );

    const tileWinW = Math.max(1, px1 - px0);
    const tileWinH = Math.max(1, py1 - py0);

    // chunk pixel range for this overlap
    const cx0 = clamp(
      Math.floor(((overlapWest - bounds.west) / (bounds.east - bounds.west)) * N),
      0,
      N - 1
    );
    const cx1 = clamp(
      Math.ceil(((overlapEast - bounds.west) / (bounds.east - bounds.west)) * N),
      1,
      N
    );
    const cz0 = clamp(
      Math.floor(((bounds.north - overlapNorth) / (bounds.north - bounds.south)) * N),
      0,
      N - 1
    );
    const cz1 = clamp(
      Math.ceil(((bounds.north - overlapSouth) / (bounds.north - bounds.south)) * N),
      1,
      N
    );

    const chunkWinW = Math.max(1, cx1 - cx0);
    const chunkWinH = Math.max(1, cz1 - cz0);

    // 用 geotiff 的 readRasters 重采样到目标 chunk 维度
    const raster = await image.readRasters({
      interleave: true,
      window: [px0, py0, px1, py1],
      width: chunkWinW,
      height: chunkWinH,
      resampleMethod: "bilinear",
      fillValue: -9999
    });

    for (let row = 0; row < chunkWinH; row += 1) {
      for (let col = 0; col < chunkWinW; col += 1) {
        const v = raster[row * chunkWinW + col];
        if (!Number.isFinite(v) || v <= -9999) continue;
        const idx = (cz0 + row) * N + (cx0 + col);
        if (Number.isFinite(heights[idx])) {
          // 多 tile 重叠 — 取平均（边界处常见）
          heights[idx] = (heights[idx] + v) * 0.5;
        } else {
          heights[idx] = v;
        }
        hasData = true;
      }
    }
  }

  if (!hasData) return null;

  // Sparse chunk filter: 边境 chunks 仅含极少数有效 cell (常 < 1%) 烤出后
  // NaN inpaint 把几个有效值扩散到整 chunk → "浮在海面的方块"。
  // 阈值 20% 有效 cell 才保留 chunk; 否则 ocean plane 接管。
  let validCount = 0;
  for (let i = 0; i < heights.length; i += 1) {
    if (Number.isFinite(heights[i])) validCount += 1;
  }
  const validRatio = validCount / heights.length;
  if (validRatio < 0.2) return null;

  return heights;
}

// ─── Higher-tier downsample (L_{n+1} = mean of 2×2 in L_n) ────────

async function downsampleTier(srcTierName, dstTierName) {
  const srcDir = path.join(pyramidOutputDir(), srcTierName);
  const dstDir = path.join(pyramidOutputDir(), dstTierName);
  await fs.mkdir(dstDir, { recursive: true });

  // 列出已存在的 src tier chunks
  const srcChunks = new Map();
  try {
    const files = await fs.readdir(srcDir);
    for (const f of files) {
      if (!f.endsWith(".bin")) continue;
      const [xs, zs] = f.replace(".bin", "").split("_");
      srcChunks.set(`${xs}_${zs}`, { x: Number(xs), z: Number(zs) });
    }
  } catch (e) {
    console.error(`No ${srcTierName} chunks found, skipping ${dstTierName}`);
    return 0;
  }

  // dst tier 的每个 chunk 对应 src tier 的 2×2 = 4 个 chunk
  // dst(x, z) corresponds to src(2x .. 2x+1, 2z .. 2z+1)
  const dstChunkSet = new Set();
  for (const [, c] of srcChunks) {
    dstChunkSet.add(`${Math.floor(c.x / 2)}_${Math.floor(c.z / 2)}`);
  }

  const N = TIER_PARAMS[srcTierName].cellsPerChunk;
  const dstTierNum = TIER_PARAMS[dstTierName].tier;
  let written = 0;

  const items = Array.from(dstChunkSet).map((k) => {
    const [x, z] = k.split("_").map(Number);
    return { x, z };
  });

  console.log(`  ${dstTierName}: ${items.length} chunks (from ${srcChunks.size} ${srcTierName} chunks)`);

  await withConcurrency(items, concurrency, async (dst) => {
    // Load 4 src chunks (may be missing 1-3)
    const srcGrid = [];
    for (let dz = 0; dz < 2; dz += 1) {
      for (let dx = 0; dx < 2; dx += 1) {
        const sx = dst.x * 2 + dx;
        const sz = dst.z * 2 + dz;
        const srcPath = path.join(srcDir, `${sx}_${sz}.bin`);
        try {
          const buf = await fs.readFile(srcPath);
          srcGrid.push({ dx, dz, buf });
        } catch {
          // chunk 不存在 (海洋区)
        }
      }
    }
    if (srcGrid.length === 0) return;

    // 解码 + 拼成 2N × 2N then 2× pool down to N × N
    const big = new Float32Array(2 * N * 2 * N).fill(Number.NaN);
    for (const { dx, dz, buf } of srcGrid) {
      // skip 8-byte header
      const view = new DataView(buf.buffer, buf.byteOffset + 8);
      for (let i = 0; i < N * N; i += 1) {
        const f16 = view.getUint16(i * 2, true);
        const f32 = float16ToFloat32(f16);
        const localRow = Math.floor(i / N);
        const localCol = i % N;
        const bigRow = dz * N + localRow;
        const bigCol = dx * N + localCol;
        big[bigRow * (2 * N) + bigCol] = f32;
      }
    }

    // 2×2 mean pool
    const out = new Float32Array(N * N).fill(Number.NaN);
    let anyData = false;
    for (let row = 0; row < N; row += 1) {
      for (let col = 0; col < N; col += 1) {
        let sum = 0;
        let count = 0;
        for (let r = 0; r < 2; r += 1) {
          for (let c = 0; c < 2; c += 1) {
            const v = big[(row * 2 + r) * (2 * N) + (col * 2 + c)];
            if (Number.isFinite(v)) {
              sum += v;
              count += 1;
            }
          }
        }
        if (count > 0) {
          out[row * N + col] = sum / count;
          anyData = true;
        }
      }
    }

    if (!anyData) return;

    const binary = encodeChunkBinary({
      tier: dstTierNum,
      chunkX: dst.x,
      chunkZ: dst.z,
      heights: out
    });
    await fs.writeFile(chunkOutputPath(dstTierName, dst.x, dst.z), binary);
    written += 1;
  });

  return written;
}

// Float16 → Float32 decoder
function float16ToFloat32(h) {
  const s = (h & 0x8000) >> 15;
  const e = (h & 0x7c00) >> 10;
  const f = h & 0x03ff;

  if (e === 0) {
    return (s ? -1 : 1) * Math.pow(2, -14) * (f / 1024);
  }
  if (e === 0x1f) {
    return f ? NaN : (s ? -Infinity : Infinity);
  }
  return (s ? -1 : 1) * Math.pow(2, e - 15) * (1 + f / 1024);
}

// ─── Main ────────────────────────────────────────────────────────

await fs.mkdir(pyramidOutputDir(), { recursive: true });

const tilesIndex = await loadFabdemTileIndex();
console.log(`Loaded ${tilesIndex.length} FABDEM tiles`);
console.log("");

// L0 烤 from FABDEM raw
if (tiers.includes("L0")) {
  console.log("─── L0 (FABDEM raw → 450m chunks) ───");
  const L0Dir = path.join(pyramidOutputDir(), "L0");
  await fs.mkdir(L0Dir, { recursive: true });

  const range = chunkGridRangeAt("L0");
  const items = [];
  for (let z = range.zMin; z <= range.zMax; z += 1) {
    for (let x = range.xMin; x <= range.xMax; x += 1) {
      const b = chunkBoundsAt("L0", x, z);
      // skip chunks outside user bbox
      if (
        b.east <= userBbox.west ||
        b.west >= userBbox.east ||
        b.north <= userBbox.south ||
        b.south >= userBbox.north
      ) {
        continue;
      }
      items.push({ x, z, bounds: b });
    }
  }

  console.log(`L0: planning ${items.length} chunks within bbox`);

  let baked = 0;
  let skipped = 0;
  let alreadyExists = 0;

  await withConcurrency(items, concurrency, async (item) => {
    const outPath = chunkOutputPath("L0", item.x, item.z);
    if (!forceOverwrite) {
      try {
        await fs.access(outPath);
        alreadyExists += 1;
        return;
      } catch {
        // doesn't exist, proceed
      }
    }

    const heights = await bakeL0Chunk({
      chunkX: item.x,
      chunkZ: item.z,
      tiles: tilesIndex
    });

    if (heights === null) {
      skipped += 1;
      return;
    }

    const binary = encodeChunkBinary({
      tier: 0,
      chunkX: item.x,
      chunkZ: item.z,
      heights
    });
    await fs.writeFile(outPath, binary);
    baked += 1;
  });

  console.log(`L0 done: ${baked} baked, ${alreadyExists} reused, ${skipped} ocean/empty`);
  console.log("");
}

// L1-L4 downsample chain
const downsamplePairs = [
  ["L0", "L1"],
  ["L1", "L2"],
  ["L2", "L3"],
  ["L3", "L4"]
];

for (const [src, dst] of downsamplePairs) {
  if (!tiers.includes(dst)) continue;
  console.log(`─── ${dst} (${src} 2×2 mean pool down) ───`);
  const w = await downsampleTier(src, dst);
  console.log(`${dst} done: ${w} written`);
  console.log("");
}

// ─── Manifest ────────────────────────────────────────────────────

console.log("─── Manifest ───");

async function listTierChunks(tierName) {
  const dir = path.join(pyramidOutputDir(), tierName);
  try {
    const files = await fs.readdir(dir);
    return files.filter((f) => f.endsWith(".bin")).map((f) => {
      const [x, z] = f.replace(".bin", "").split("_").map(Number);
      return { x, z };
    });
  } catch {
    return [];
  }
}

const manifest = {
  schemaVersion: "visual-china.dem-pyramid.v1",
  generatedAt: new Date().toISOString(),
  generator: "scripts/build-dem-pyramid.mjs",
  source: "FABDEM V1-2 (Hawker et al., 2022)",
  bounds: chinaBounds,
  projection: "strict-geographic",
  tiers: {}
};

for (const t of TIER_NAMES) {
  const chunks = await listTierChunks(t);
  if (chunks.length === 0) continue;
  const cellM = cellMetersAtTier(t);
  manifest.tiers[t] = {
    tier: TIER_PARAMS[t].tier,
    cellsPerChunk: TIER_PARAMS[t].cellsPerChunk,
    chunkSizeDeg: TIER_PARAMS[t].chunkSizeDeg,
    cellMeters: Number(cellM.toFixed(1)),
    chunkCount: chunks.length,
    chunkRangeX: chunks.reduce(
      (acc, c) => [Math.min(acc[0], c.x), Math.max(acc[1], c.x)],
      [Infinity, -Infinity]
    ),
    chunkRangeZ: chunks.reduce(
      (acc, c) => [Math.min(acc[0], c.z), Math.max(acc[1], c.z)],
      [Infinity, -Infinity]
    )
  };
}

await fs.writeFile(manifestOutputPath(), JSON.stringify(manifest, null, 2));
console.log(`Manifest written: ${manifestOutputPath()}`);
console.log("");
console.log("=".repeat(60));
console.log("Pyramid build complete!");
console.log("=".repeat(60));

for (const t of TIER_NAMES) {
  if (manifest.tiers[t]) {
    const info = manifest.tiers[t];
    console.log(
      `  ${t}: ${info.chunkCount} chunks at ${info.cellMeters}m/cell, range x=${info.chunkRangeX.join("-")} z=${info.chunkRangeZ.join("-")}`
    );
  }
}
