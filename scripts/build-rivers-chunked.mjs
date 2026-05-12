// build-rivers-chunked.mjs
//
// P2 — 从 HydroSHEDS HydroRIVERS shapefile (全亚洲, ~1.7M polylines)
// 提取中国境内的河流 polyline，按 L0 chunk grid 切分。
//
// 输出:
//   public/data/rivers/manifest.json      — meta + chunk index
//   public/data/rivers/{x}_{z}.json       — 该 L0 chunk 内的 polyline 列表
//
// 用法:
//   node scripts/build-rivers-chunked.mjs                  # 默认全中国 ord_stra >= 3
//   node scripts/build-rivers-chunked.mjs --min-order=4    # 只保留主干 (ord >= 4)
//   node scripts/build-rivers-chunked.mjs --bbox=...
//   node scripts/build-rivers-chunked.mjs --dry-run

import fs from "node:fs/promises";
import path from "node:path";
import { open as shpOpen } from "shapefile";

import { chinaBounds, workspacePath } from "./china-dem-common.mjs";
import {
  TIER_PARAMS,
  chunkBoundsAt,
  chunkGridRangeAt
} from "./dem-pyramid-common.mjs";

const args = process.argv.slice(2);
const getFlag = (n) => args.some((a) => a === `--${n}`);
const getOpt = (n, d = null) => {
  const f = args.find((a) => a.startsWith(`--${n}=`));
  return f ? f.split("=").slice(1).join("=") : d;
};

const dryRun = getFlag("dry-run");
// ord_stra 1-12, larger = bigger river. 1-2 are small streams (~1.2M of 1.7M).
// 默认保 ord >= 3 (中型支流以上) — 大约 200K-300K polylines, ~50 MB chunked output
const minOrder = Number(getOpt("min-order", 3));
const bboxOpt = getOpt("bbox", null);
const userBbox = bboxOpt
  ? (() => {
      const [w, s, e, n] = bboxOpt.split(",").map(Number);
      return { west: w, south: s, east: e, north: n };
    })()
  : chinaBounds;

const SHP_PATH = workspacePath(
  "data",
  "hydrosheds",
  "HydroRIVERS_v10_as_shp",
  "HydroRIVERS_v10_as.shp"
);
const OUT_DIR = workspacePath("public", "data", "rivers");

console.log("=".repeat(60));
console.log("Rivers chunked builder (P2)");
console.log("=".repeat(60));
console.log(`Source:       ${SHP_PATH}`);
console.log(`Output:       ${OUT_DIR}`);
console.log(`Min ord_stra: ${minOrder}`);
console.log(`Bbox:         ${userBbox.west}-${userBbox.east}°E × ${userBbox.south}-${userBbox.north}°N`);
console.log(`Dry-run:      ${dryRun}`);
console.log("");

// ─── Step 1: 扫一遍 shp，过滤到 China bbox & ord >= minOrder ─────

console.log("Reading HydroRIVERS shapefile...");
const t0 = Date.now();

const source = await shpOpen(SHP_PATH);

// Track:
//   - 中国境内符合 ord 的 polylines
//   - 每个 polyline 已分割好的 chunk-bucket
const chunkBuckets = new Map(); // "x_z" → array of polylines

function chunkKeyForPoint(lon, lat) {
  const sz = TIER_PARAMS.L0.chunkSizeDeg;
  const x = Math.floor((lon - chinaBounds.west) / sz);
  const z = Math.floor((chinaBounds.north - lat) / sz);
  return { x, z, key: `${x}_${z}` };
}

function inBbox(lon, lat) {
  return (
    lon >= userBbox.west &&
    lon <= userBbox.east &&
    lat >= userBbox.south &&
    lat <= userBbox.north
  );
}

let totalRead = 0;
let totalInChina = 0;
let totalKept = 0;
let totalSegments = 0;

while (true) {
  const r = await source.read();
  if (r.done) break;
  totalRead += 1;
  if (totalRead % 100000 === 0) {
    console.log(
      `  read ${totalRead}, in-China ${totalInChina}, kept ${totalKept}, ` +
        `bucketed-segments ${totalSegments}`
    );
  }

  const f = r.value;
  if (f.geometry.type !== "LineString") continue;
  const coords = f.geometry.coordinates;
  if (coords.length < 2) continue;

  // 快速 bbox reject: 任意一点在 China bbox 内就保留 polyline
  let anyInChina = false;
  for (const [lon, lat] of coords) {
    if (lon >= chinaBounds.west && lon <= chinaBounds.east && lat >= chinaBounds.south && lat <= chinaBounds.north) {
      anyInChina = true;
      break;
    }
  }
  if (!anyInChina) continue;
  totalInChina += 1;

  const ord = f.properties.ORD_STRA || 0;
  if (ord < minOrder) continue;
  totalKept += 1;

  // Split polyline into per-chunk segments
  // Strategy: scan点by点. 每当点跨入新 chunk → close current segment, start new one in new chunk.
  let curSeg = null;
  let curKey = null;
  for (const [lon, lat] of coords) {
    if (!inBbox(lon, lat)) {
      // out of user bbox — close current seg
      if (curSeg && curSeg.length >= 2) {
        if (!chunkBuckets.has(curKey)) chunkBuckets.set(curKey, []);
        chunkBuckets.get(curKey).push({
          id: f.properties.HYRIV_ID,
          ord,
          flow: f.properties.DIS_AV_CMS || 0,
          coords: curSeg
        });
        totalSegments += 1;
      }
      curSeg = null;
      curKey = null;
      continue;
    }
    const k = chunkKeyForPoint(lon, lat);
    if (k.key !== curKey) {
      // chunk transition — flush old seg (with overlap one point for continuity)
      if (curSeg && curSeg.length >= 1) {
        // Add this lon/lat as boundary point to old chunk too (for visual continuity)
        curSeg.push([lon, lat]);
        if (curSeg.length >= 2) {
          if (!chunkBuckets.has(curKey)) chunkBuckets.set(curKey, []);
          chunkBuckets.get(curKey).push({
            id: f.properties.HYRIV_ID,
            ord,
            flow: f.properties.DIS_AV_CMS || 0,
            coords: curSeg
          });
          totalSegments += 1;
        }
      }
      // Start new seg in new chunk; include this point
      curSeg = [[lon, lat]];
      curKey = k.key;
    } else {
      curSeg.push([lon, lat]);
    }
  }
  // Final flush
  if (curSeg && curSeg.length >= 2) {
    if (!chunkBuckets.has(curKey)) chunkBuckets.set(curKey, []);
    chunkBuckets.get(curKey).push({
      id: f.properties.HYRIV_ID,
      ord,
      flow: f.properties.DIS_AV_CMS || 0,
      coords: curSeg
    });
    totalSegments += 1;
  }
}

const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
console.log("");
console.log(`Read complete in ${elapsed}s`);
console.log(`  total polylines:     ${totalRead}`);
console.log(`  in China bbox:       ${totalInChina}`);
console.log(`  kept (ord>=${minOrder}):     ${totalKept}`);
console.log(`  per-chunk segments:  ${totalSegments}`);
console.log(`  unique chunks:       ${chunkBuckets.size}`);
console.log("");

if (dryRun) {
  console.log("(dry-run, not writing)");
  process.exit(0);
}

// ─── Step 2: 写每 chunk JSON ─────────────────────────────────────

await fs.mkdir(OUT_DIR, { recursive: true });

let chunksWritten = 0;
let totalBytes = 0;

// Sort chunks for deterministic output
const sortedKeys = Array.from(chunkBuckets.keys()).sort();

for (const key of sortedKeys) {
  const [x, z] = key.split("_").map(Number);
  const segs = chunkBuckets.get(key);
  // Round coords to 5 decimal places (~1m precision) to save space
  for (const s of segs) {
    s.coords = s.coords.map(([lon, lat]) => [
      Number(lon.toFixed(5)),
      Number(lat.toFixed(5))
    ]);
  }
  const json = {
    schemaVersion: "visual-china.rivers-chunk.v1",
    chunkX: x,
    chunkZ: z,
    bounds: chunkBoundsAt("L0", x, z),
    minOrder,
    polylineCount: segs.length,
    polylines: segs
  };
  const out = path.join(OUT_DIR, `${x}_${z}.json`);
  const text = JSON.stringify(json);
  await fs.writeFile(out, text);
  totalBytes += text.length;
  chunksWritten += 1;
}

// ─── Step 3: manifest.json ───────────────────────────────────────

const manifest = {
  schemaVersion: "visual-china.rivers-pyramid.v1",
  generatedAt: new Date().toISOString(),
  generator: "scripts/build-rivers-chunked.mjs",
  source: "HydroSHEDS HydroRIVERS v1.0 (Lehner & Grill, 2013)",
  bounds: chinaBounds,
  projection: "strict-geographic",
  minOrder,
  tierGrid: "L0", // chunk grid aligns with DEM pyramid L0
  totalPolylines: totalKept,
  totalSegments,
  chunkCount: chunkBuckets.size,
  chunks: sortedKeys.map((k) => {
    const [x, z] = k.split("_").map(Number);
    return { x, z, file: `${k}.json`, count: chunkBuckets.get(k).length };
  })
};

await fs.writeFile(
  path.join(OUT_DIR, "manifest.json"),
  JSON.stringify(manifest, null, 2)
);

console.log("=".repeat(60));
console.log(`P2 complete!`);
console.log("=".repeat(60));
console.log(`  Chunks written:  ${chunksWritten}`);
console.log(`  Total bytes:     ${(totalBytes / 1024 / 1024).toFixed(1)} MB`);
console.log(`  Manifest:        ${path.join(OUT_DIR, "manifest.json")}`);
