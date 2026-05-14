#!/usr/bin/env node
// Build China land mask from GSHHG full-resolution coastlines.
//
// Source: GSHHG 2.3.7 (Wessel & Smith, public domain via NOAA/SOEST/GitHub)
//   - GSHHS_f_L1.shp = full-resolution continental coastlines (~100-500m segment precision)
//
// 升级路径：NE 50m (~13km segs) → NE 10m (~2.4km) → GSHHG full (~100-500m)
// 这一档的精度能跟 DEM 430m/cell 同量级，让 mesh-clip + binary search 真正发挥.

import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

const GSHHG_ZIP = path.resolve("data/gshhg/gshhg-shp-2.3.7.zip");
const GSHHG_EXTRACT_DIR = path.resolve("data/gshhg/extracted");
const SHP_PATH = path.join(GSHHG_EXTRACT_DIR, "GSHHS_f_L1.shp");
const DBF_PATH = path.join(GSHHG_EXTRACT_DIR, "GSHHS_f_L1.dbf");
const OUT_PATH = path.resolve("public/data/china/land-mask.json");

const BOUNDS = { west: 70, east: 140, south: 15, north: 55 };

async function ensureExtracted() {
  try {
    await fs.access(SHP_PATH);
    return;
  } catch {}
  console.log(`解压 GSHHS_shp/f/L1 → ${GSHHG_EXTRACT_DIR}`);
  await fs.mkdir(GSHHG_EXTRACT_DIR, { recursive: true });
  // -j: junk path 把文件平铺到 extract dir; -o: overwrite
  execSync(
    `unzip -j -o "${GSHHG_ZIP}" "GSHHS_shp/f/GSHHS_f_L1.*" -d "${GSHHG_EXTRACT_DIR}"`,
    { stdio: "inherit" }
  );
}

function ringBbox(ring) {
  let west = Infinity;
  let east = -Infinity;
  let south = Infinity;
  let north = -Infinity;
  for (const [lon, lat] of ring) {
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  }
  return { west, east, south, north };
}

function intersects(a, b) {
  return !(
    a.east < b.west ||
    a.west > b.east ||
    a.north < b.south ||
    a.south > b.north
  );
}

function closeRing(ring) {
  if (ring.length === 0) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) return ring;
  return [...ring, first];
}

// Douglas-Peucker 多边形简化 — 把 polygon 顶点抽稀到 tolerance (lat/lon 度) 精度.
// 算法: 找 first→last 直线段最远的点, 距离超过 tolerance 就保留并递归两侧, 否则全部删掉.
// 用 iterative explicit stack, 长 ring (10K+ 顶点) 不会 stack overflow.
//
// tolerance 选 0.004° ≈ DEM cell 对角约 0.005°, 跟地形精度严格匹配 — 多余精度就是浪费.
function perpDist(p, a, b) {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  if (dx === 0 && dy === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
  const tc = Math.max(0, Math.min(1, t));
  const px = a[0] + tc * dx;
  const py = a[1] + tc * dy;
  return Math.hypot(p[0] - px, p[1] - py);
}

function simplifyDP(ring, tolerance) {
  const n = ring.length;
  if (n < 3) return [...ring];
  // 标记保留的顶点
  const keep = new Uint8Array(n);
  keep[0] = 1;
  keep[n - 1] = 1;
  const stack = [[0, n - 1]];
  while (stack.length > 0) {
    const [first, last] = stack.pop();
    if (last - first < 2) continue;
    let maxDist = 0;
    let maxIdx = first;
    for (let i = first + 1; i < last; i += 1) {
      const d = perpDist(ring[i], ring[first], ring[last]);
      if (d > maxDist) {
        maxDist = d;
        maxIdx = i;
      }
    }
    if (maxDist > tolerance) {
      keep[maxIdx] = 1;
      stack.push([first, maxIdx]);
      stack.push([maxIdx, last]);
    }
  }
  const out = [];
  for (let i = 0; i < n; i += 1) if (keep[i]) out.push(ring[i]);
  return out;
}

await ensureExtracted();

// shpjs 是 CJS 模块，dynamic import 拿到 default export
const shpModule = await import("shpjs");
const shp = shpModule.default ?? shpModule;
const shpBuf = await fs.readFile(SHP_PATH);
const dbfBuf = await fs.readFile(DBF_PATH);
console.log(`shp ${(shpBuf.length / 1024 / 1024).toFixed(1)} MB, dbf ${(dbfBuf.length / 1024).toFixed(1)} KB`);

// 把 Node Buffer 转 ArrayBuffer (shpjs 期望 ArrayBuffer)
const toArrayBuffer = (b) => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
const fc = await shp({ shp: toArrayBuffer(shpBuf), dbf: toArrayBuffer(dbfBuf) });
console.log(`GSHHG L1 features parsed: ${fc.features.length}`);

// DEM cell 是 1°/256 = 0.0039°. tolerance 设到 0.004° 让 polygon 简化精度 ≈ 1 个 DEM cell —
// 不浪费精度, 也不损失视觉 (mesh-clip 反正卡在 DEM cell 粒度上).
const SIMPLIFY_TOLERANCE_DEG = 0.004;

const polygons = [];
let sourcePolygonCount = 0;
let rawVertexCount = 0;
let pointCount = 0;
for (const feature of fc.features) {
  const geom = feature.geometry;
  if (!geom) continue;
  const sourcePolys =
    geom.type === "Polygon"
      ? [geom.coordinates]
      : geom.type === "MultiPolygon"
        ? geom.coordinates
        : [];
  for (const polygon of sourcePolys) {
    sourcePolygonCount += 1;
    if (polygon.length === 0) continue;
    const outerBbox = ringBbox(polygon[0]);
    if (!intersects(outerBbox, BOUNDS)) continue;
    const rings = polygon.map((ring) => {
      rawVertexCount += ring.length;
      const closed = closeRing(ring);
      // 短 ring 完全不简化 — 小岛 < 12 顶点直接保留, 简化只会让它退化无法渲染
      // (ring 最少 4 顶点构成三角形 + closing repeat; <4 = 退化)
      if (closed.length < 12) return closed;
      const simplified = simplifyDP(closed, SIMPLIFY_TOLERANCE_DEG);
      // 简化后退化 (< 4) 也回退到原 ring — 视觉上小岛永不丢
      return simplified.length >= 4 ? simplified : closed;
    });
    polygons.push(rings);
    for (const ring of rings) pointCount += ring.length;
  }
}

const out = {
  schema: "visual-china.land-mask.v1",
  generatedAt: new Date().toISOString(),
  sourceData:
    "GSHHG 2.3.7 full-resolution L1 coastlines (public domain) — Wessel & Smith via NOAA/SOEST",
  sourceUrl: "https://www.soest.hawaii.edu/pwessel/gshhg/",
  simplificationToleranceDeg: SIMPLIFY_TOLERANCE_DEG,
  simplificationNote: `Douglas-Peucker simplified to ~${SIMPLIFY_TOLERANCE_DEG}° (≈ DEM cell size, 256/° × 1° = 0.0039°/cell). Raw vertex count was ${rawVertexCount}, kept ${pointCount} (${(100 * pointCount / rawVertexCount).toFixed(1)}%).`,
  bounds: BOUNDS,
  sourcePolygonCount,
  polygonCount: polygons.length,
  pointCount,
  polygons
};

await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
await fs.writeFile(OUT_PATH, `${JSON.stringify(out)}\n`, "utf8");
console.log(`Source polygons: ${sourcePolygonCount}, filtered to China bbox: ${polygons.length}`);
console.log(`Raw vertices: ${rawVertexCount}, after Douglas-Peucker @ ${SIMPLIFY_TOLERANCE_DEG}°: ${pointCount} (${(100 * pointCount / rawVertexCount).toFixed(1)}%)`);
console.log(`Wrote ${OUT_PATH}`);
