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
//
// 算法: cell-center direct sampling (修陡崖条带 root cause)
// 之前用 readRasters resample(window→N×N) 在 chunk window 边界处 bilinear
// 没 ghost cells, 邻 chunks 各自 resample 不同结果 → seam.
//
// 现在: 每个 cell 算它的 geographic 中心 (lon_c, lat_c), 找包含的 tile, 计算
// tile pixel coord, bilinear in pixel space. 两个相邻 chunks 跨边界共享同一
// lon/lat 的 cells 必然从同一 raster pixels 取值 → 自动对齐.

// Tile pixel cache: full tile pixel data, indexed once per tile.
const tilePixelCache = new Map(); // tile.path → { pixels: Float32Array, width, height, ...tile }

async function loadTilePixels(tile) {
  if (tilePixelCache.has(tile.path)) return tilePixelCache.get(tile.path);
  const entry = await tileCache.get(tile);
  const { image, width, height } = entry;
  // Read whole tile in one go
  const raster = await image.readRasters({
    interleave: true,
    fillValue: -9999
  });
  const pixels = raster instanceof Float32Array ? raster : Float32Array.from(raster);
  const cached = {
    pixels,
    width,
    height,
    west: entry.west,
    east: entry.east,
    north: entry.north,
    south: entry.south
  };
  tilePixelCache.set(tile.path, cached);
  // LRU eviction if too many
  if (tilePixelCache.size > 32) {
    const firstKey = tilePixelCache.keys().next().value;
    tilePixelCache.delete(firstKey);
  }
  return cached;
}

// Sample raw FABDEM elevation at (lon, lat) using bilinear in tile pixel space.
// Returns NaN if no tile covers this point.
function sampleAt(lon, lat, tilesIndex) {
  // Find tile containing (lon, lat); use <= to include north/east edges
  // (vertex sampling means we exactly hit chunk边界 lon/lat values)
  for (const t of tilesIndex) {
    if (lon >= t.west && lon <= t.east && lat >= t.south && lat <= t.north) {
      const cached = tilePixelCache.get(t.path);
      if (!cached) {
        // Tile not loaded yet — caller must preload all overlapping tiles first
        return NaN;
      }
      const { pixels, width, height } = cached;
      // (lon, lat) → pixel coord (in tile)
      // Tile is north-to-south top-down. row 0 is northernmost.
      const u = (lon - t.west) / (t.east - t.west);
      const v = (t.north - lat) / (t.north - t.south);
      // pixel (u*width, v*height) in float
      const px = u * (width - 1);
      const py = v * (height - 1);
      const col0 = Math.floor(px);
      const row0 = Math.floor(py);
      const col1 = Math.min(width - 1, col0 + 1);
      const row1 = Math.min(height - 1, row0 + 1);
      const fc = px - col0;
      const fr = py - row0;
      const v00 = pixels[row0 * width + col0];
      const v01 = pixels[row0 * width + col1];
      const v10 = pixels[row1 * width + col0];
      const v11 = pixels[row1 * width + col1];
      // Bilinear with NaN handling
      let sum = 0;
      let wSum = 0;
      const samples = [
        { val: v00, w: (1 - fc) * (1 - fr) },
        { val: v01, w: fc * (1 - fr) },
        { val: v10, w: (1 - fc) * fr },
        { val: v11, w: fc * fr }
      ];
      for (const s of samples) {
        if (Number.isFinite(s.val) && s.val > -9999 && s.w > 0) {
          sum += s.val * s.w;
          wSum += s.w;
        }
      }
      return wSum > 0 ? sum / wSum : NaN;
    }
  }
  return NaN;
}

async function bakeL0Chunk({ chunkX, chunkZ, tiles, ghostWidth = 1 }) {
  const bounds = chunkBoundsAt("L0", chunkX, chunkZ);

  // Ghost-aware bounds: 比 chunk 边界向外延 ghostWidth 个 cell 找 tile.
  const N = TIER_PARAMS.L0.cellsPerChunk;
  const lonSpan = bounds.east - bounds.west;
  const latSpan = bounds.north - bounds.south;
  const denom = N - 1;
  const cellLonDeg = lonSpan / denom;
  const cellLatDeg = latSpan / denom;
  const expandedBounds = ghostWidth > 0
    ? {
        west: bounds.west - cellLonDeg * ghostWidth,
        east: bounds.east + cellLonDeg * ghostWidth,
        north: bounds.north + cellLatDeg * ghostWidth,
        south: bounds.south - cellLatDeg * ghostWidth
      }
    : bounds;

  const overlapping = tilesCoveringChunk(tiles, expandedBounds);
  if (overlapping.length === 0) return null;

  for (const t of overlapping) {
    await loadTilePixels(t);
  }

  // 数组边 = N + 2*ghostWidth. 内部 [ghostWidth..ghostWidth+N) 是 mesh vertex 对应,
  // 外圈是 ghost cells (跨 chunk smooth/normal 用).
  // 几何: array index r → lat = north - (r - ghostWidth) * cellLatDeg
  //   r=ghostWidth → lat=north (mesh row 0)
  //   r=ghostWidth+N-1 → lat=south (mesh row N-1)
  //   r=0 (北 ghost) → lat = north + cellLatDeg (邻居北 chunk 的最南 vertex)
  const arraySide = N + 2 * ghostWidth;
  const heights = new Float32Array(arraySide * arraySide).fill(Number.NaN);
  let hasData = false;
  let validInnerCount = 0;

  for (let r = 0; r < arraySide; r += 1) {
    const lat = bounds.north - (r - ghostWidth) * cellLatDeg;
    for (let c = 0; c < arraySide; c += 1) {
      const lon = bounds.west + (c - ghostWidth) * cellLonDeg;
      const v = sampleAt(lon, lat, overlapping);
      if (Number.isFinite(v)) {
        heights[r * arraySide + c] = v;
        hasData = true;
        const isInner =
          r >= ghostWidth && r < ghostWidth + N &&
          c >= ghostWidth && c < ghostWidth + N;
        if (isInner) validInnerCount += 1;
      }
    }
  }

  if (!hasData) return null;

  // Sparse filter 仅基于内部 N×N (ghost 不算)
  const validRatio = validInnerCount / (N * N);
  if (validRatio < 0.05) return null;

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
  const writtenChunks = [];

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
    // src 可能是 v1 (N²) 或 v2 (N+2)² with ghost ring. 后者取内部 N×N.
    const big = new Float32Array(2 * N * 2 * N).fill(Number.NaN);
    for (const { dx, dz, buf } of srcGrid) {
      const version = buf.readUInt8(2);
      const dataBytes = buf.length - 8;
      const arraySide = Math.round(Math.sqrt(dataBytes / 2));
      const ghostWidth = version === 2 ? 1 : 0;
      const view = new DataView(buf.buffer, buf.byteOffset + 8);
      // 读 inner N×N (跳过 ghost ring)
      for (let row = 0; row < N; row += 1) {
        for (let col = 0; col < N; col += 1) {
          const srcRow = row + ghostWidth;
          const srcCol = col + ghostWidth;
          const f16 = view.getUint16((srcRow * arraySide + srcCol) * 2, true);
          const f32 = float16ToFloat32(f16);
          const bigRow = dz * N + row;
          const bigCol = dx * N + col;
          big[bigRow * (2 * N) + bigCol] = f32;
        }
      }
    }

    // 2×2 mean pool + validRatio
    const out = new Float32Array(N * N).fill(Number.NaN);
    let validCount = 0;
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
          validCount += 1;
        }
      }
    }
    const validRatio = validCount / (N * N);

    // Sparse parent filter (codex P1 #5 修): L1 ≥ 30%, L2 ≥ 40%, L3 ≥ 50%.
    // 低阈值 chunk 全是 NaN → mesh fallback Y=-3 ocean plane, 视觉上是"大海洋矩形"
    // 假装是 chunk. 不写就交给 runtime fallback 到 finer tier 或 ocean plane 兜底.
    const sparseThresholds = { L1: 0.30, L2: 0.40, L3: 0.50, L4: 0.50 };
    const threshold = sparseThresholds[dstTierName] ?? 0;
    if (validRatio < threshold) {
      // 删除已存在的旧 sparse parent 文件 (上次 bake 写过的)
      try { await fs.unlink(chunkOutputPath(dstTierName, dst.x, dst.z)); } catch {}
      return;
    }

    const binary = encodeChunkBinary({
      tier: dstTierNum,
      chunkX: dst.x,
      chunkZ: dst.z,
      heights: out
    });
    await fs.writeFile(chunkOutputPath(dstTierName, dst.x, dst.z), binary);
    writtenChunks.push({ x: dst.x, z: dst.z, validRatio: +validRatio.toFixed(3) });
    written += 1;
  });

  return { written, chunks: writtenChunks };
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
      heights,
      ghostWidth: 1
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

// Per-tier chunks list (with validRatio) — manifest emit 用
const tierChunksList = {};

for (const [src, dst] of downsamplePairs) {
  if (!tiers.includes(dst)) continue;
  console.log(`─── ${dst} (${src} 2×2 mean pool down) ───`);
  const r = await downsampleTier(src, dst);
  tierChunksList[dst] = r.chunks;
  console.log(`${dst} done: ${r.written} written (validRatio threshold filtered)`);
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
  // v2 schema: 每 tier 多 chunks[] (exact existence index + 可选 validRatio)
  schemaVersion: "visual-china.dem-pyramid.v2",
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
  // L1-L4: 用 downsampleTier 返回的 validRatio. L0: 单 {x,z} 无 ratio (bake 时已
  // 阈值 0.05 过, 后续若需精确可读 bin 计算).
  const chunkList = tierChunksList[t]
    ? tierChunksList[t].map((c) => ({ x: c.x, z: c.z, validRatio: c.validRatio }))
    : chunks.map((c) => ({ x: c.x, z: c.z }));
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
    ),
    chunks: chunkList
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
