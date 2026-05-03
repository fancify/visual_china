#!/usr/bin/env node
// 把全国 NE 数据里跟秦岭切片相关的主河 clip 到 slice bbox，
// 加上 OSM 里能拼出的上游岷江，写出 src/game/data/qinlingNeRivers.js
//
// - 渭河/汉水/嘉陵江: NE 10m 真实曲线 (~263/240/361 点)
// - 岷江: NE 10m 没收上游，从 OSM 35 段 way 拼起来 (松潘 → 都江堰)
// - 褒水/斜水/外江/内江: NE/OSM 都太碎，留 qinlingHydrography.js 手画
//
// Usage: node scripts/build-qinling-hydrography-from-ne.mjs

import fs from "node:fs/promises";
import path from "node:path";

const RIVERS_PATH = path.resolve("public/data/china/major-rivers.json");
const OSM_PATH = path.resolve("public/data/regions/qinling/hydrography/osm-modern.json");
const OUT_PATH = path.resolve("src/game/data/qinlingNeRivers.js");

// 用于把 OSM 的 {x, y=z} 反投回 {lat, lon}
const QINLING_BOUNDS = { west: 103.5, east: 110, south: 30.4, north: 35.4 };
const QINLING_WORLD = { width: 180, depth: 240 };
function unprojectWorldToGeo({ x, y }) {
  const lonSpan = QINLING_BOUNDS.east - QINLING_BOUNDS.west;
  const latSpan = QINLING_BOUNDS.north - QINLING_BOUNDS.south;
  return {
    lon: QINLING_BOUNDS.west + (x / QINLING_WORLD.width + 0.5) * lonSpan,
    // OSM 的 y = atlas z; lat = south + (0.5 - z/depth)*latSpan
    lat: QINLING_BOUNDS.south + (0.5 - y / QINLING_WORLD.depth) * latSpan
  };
}

// 切片范围
const SLICE_BBOX = { west: 103.5, east: 110, south: 30.4, north: 35.4 };

// NE name → 我们 game 的 river id 映射 + 主流方向
// flowDir: "lon-asc" = W→E (lon 递增), "lon-desc" = E→W, "lat-desc" = N→S, "lat-asc" = S→N
const NAME_TO_ID = {
  "渭河":   { id: "river-weihe",        flowDir: "lon-asc"  },  // 黄土高原 W → 关中 E
  "汉水":   { id: "river-hanjiang",     flowDir: "lon-asc"  },  // 汉中 W → 安康/丹江口 E
  "嘉陵江": { id: "river-jialingjiang", flowDir: "lat-desc" },  // 凤县 N → 广元/重庆 S
  "岷江":   { id: "river-minjiang",     flowDir: "lat-desc" }   // 松潘 N → 宜宾 S
};

// greedy join 不保证 traversal order — 子段被反向拼接时会跳点 (例如
// "去南再回北再去南"，渲染成横穿地形的折返线)。按主流方向硬排序修。
function sortByFlowDir(points, flowDir) {
  const sorted = points.slice();
  switch (flowDir) {
    case "lon-asc":  sorted.sort((a, b) => a[0] - b[0]); break;
    case "lon-desc": sorted.sort((a, b) => b[0] - a[0]); break;
    case "lat-asc":  sorted.sort((a, b) => a[1] - b[1]); break;
    case "lat-desc": sorted.sort((a, b) => b[1] - a[1]); break;
  }
  return sorted;
}

// Cohen-Sutherland 线段对 bbox 裁剪
function clipSegment([x1, y1], [x2, y2], { west, south, east, north }) {
  const code = (x, y) => {
    let c = 0;
    if (x < west) c |= 1;
    if (x > east) c |= 2;
    if (y < south) c |= 4;
    if (y > north) c |= 8;
    return c;
  };
  let c1 = code(x1, y1);
  let c2 = code(x2, y2);
  // 防御性循环上限，避免病态输入死循环
  for (let i = 0; i < 16; i += 1) {
    if (!(c1 | c2)) return [[x1, y1], [x2, y2]];
    if (c1 & c2) return null;
    const cOut = c1 || c2;
    let x;
    let y;
    if (cOut & 8) {
      x = x1 + ((x2 - x1) * (north - y1)) / (y2 - y1);
      y = north;
    } else if (cOut & 4) {
      x = x1 + ((x2 - x1) * (south - y1)) / (y2 - y1);
      y = south;
    } else if (cOut & 2) {
      y = y1 + ((y2 - y1) * (east - x1)) / (x2 - x1);
      x = east;
    } else {
      y = y1 + ((y2 - y1) * (west - x1)) / (x2 - x1);
      x = west;
    }
    if (cOut === c1) {
      x1 = x;
      y1 = y;
      c1 = code(x1, y1);
    } else {
      x2 = x;
      y2 = y;
      c2 = code(x2, y2);
    }
  }
  return null;
}

// 把一条 polyline (LineString) 按 bbox 裁剪，可能拆成多段
function clipPolyline(line, bbox) {
  const out = [];
  let current = null;
  for (let i = 0; i < line.length - 1; i += 1) {
    const seg = clipSegment(line[i], line[i + 1], bbox);
    if (!seg) {
      if (current && current.length > 1) out.push(current);
      current = null;
      continue;
    }
    const [a, b] = seg;
    if (!current) {
      current = [a, b];
    } else {
      const last = current[current.length - 1];
      if (last[0] === a[0] && last[1] === a[1]) {
        current.push(b);
      } else {
        // 出 bbox 又入回来 — 关掉旧的开新的
        if (current.length > 1) out.push(current);
        current = [a, b];
      }
    }
  }
  if (current && current.length > 1) out.push(current);
  return out;
}

// 把 polyline 按目标间隔密化 — 在每对相邻点之间插入足够多 lerp 点，
// 让相邻输出点不超过 maxDeg (≈度数；slice 比例 ~110km/度，0.018° ≈ 2km)。
// 目的：让 (1) DEM carving 覆盖整条河, (2) ribbon 渲染不画长直线 (避免
// "河走 47km 直线穿山"). 把这一步放在 build 而不是 runtime，省 runtime cost。
function densifyPolylineLatLon(points, maxDeg = 0.018) {
  if (points.length < 2) return points.slice();
  const out = [points[0]];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const dist = Math.hypot(b.lat - a.lat, b.lon - a.lon);
    const subdivisions = Math.max(1, Math.ceil(dist / maxDeg));
    for (let j = 1; j <= subdivisions; j += 1) {
      const t = j / subdivisions;
      out.push({ lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t });
    }
  }
  return out;
}

// 把端点距离 < tolerance 的子段缝起来。greedy: 反复找一条线，看能不能把
// 任何一条剩余子段拼到它两端，能拼就拼，不能拼就把当前线放进结果换下一条。
function joinPolylines(lines, tolerance) {
  const remaining = lines.map((l) => l.slice());
  const out = [];
  while (remaining.length > 0) {
    const cur = remaining.shift();
    let progress = true;
    while (progress) {
      progress = false;
      const head = cur[0];
      const tail = cur[cur.length - 1];
      for (let i = 0; i < remaining.length; i += 1) {
        const cand = remaining[i];
        const cHead = cand[0];
        const cTail = cand[cand.length - 1];
        const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (d(tail, cHead) <= tolerance) {
          cur.push(...cand.slice(1));
          remaining.splice(i, 1);
          progress = true;
          break;
        }
        if (d(tail, cTail) <= tolerance) {
          cur.push(...cand.slice(0, -1).reverse());
          remaining.splice(i, 1);
          progress = true;
          break;
        }
        if (d(head, cTail) <= tolerance) {
          cur.unshift(...cand.slice(0, -1));
          remaining.splice(i, 1);
          progress = true;
          break;
        }
        if (d(head, cHead) <= tolerance) {
          cur.unshift(...cand.slice(1).reverse());
          remaining.splice(i, 1);
          progress = true;
          break;
        }
      }
    }
    out.push(cur);
  }
  return out;
}

const data = JSON.parse(await fs.readFile(RIVERS_PATH, "utf8"));
const result = {};
let totalIn = 0;
let totalOut = 0;
for (const river of data.rivers) {
  const meta = NAME_TO_ID[river.name];
  if (!meta) continue;
  if (!river.polylines || river.polylines.length === 0) continue;
  const clipped = [];
  for (const line of river.polylines) {
    const segs = clipPolyline(line, SLICE_BBOX);
    clipped.push(...segs);
  }
  const inPoints = river.polylines.reduce((s, p) => s + p.length, 0);
  const outPoints = clipped.reduce((s, p) => s + p.length, 0);
  totalIn += inPoints;
  totalOut += outPoints;
  if (clipped.length === 0) {
    console.log(
      `${river.name.padEnd(6)}  ⚠️  ${river.polylines.length} polyline(s) ${inPoints} pts → 0 inside slice (NE 10m 在切片范围内没有此河，保留 hand-typed)`
    );
    continue;
  }
  // NE 把河流在每条支流汇入处切断，clip 完会得到几段端点接近的子段。
  // 0.05° (~5 km) 内的端点视为同一点，缝回去成单条 points 数组。
  const joined = joinPolylines(clipped, 0.05);
  console.log(
    `${river.name.padEnd(6)}  ${river.polylines.length} polyline(s) ${inPoints} pts → ${clipped.length} clipped → ${joined.length} joined (longest ${Math.max(...joined.map((l) => l.length))} pts)`
  );
  // 取最长的那条作为主流；其余作为额外段（一般是支流交汇造成的小残段）
  joined.sort((a, b) => b.length - a.length);
  // 按主流方向排序所有点 (修 greedy join 跳序问题)
  const primarySorted = sortByFlowDir(joined[0], meta.flowDir);
  // 密化 (~2km 间隔)：保证 carving 覆盖整段、ribbon 不画长直线
  const densified = densifyPolylineLatLon(
    primarySorted.map(([lon, lat]) => ({ lat, lon })),
    0.018
  );
  result[meta.id] = {
    name: river.name,
    sourceScore: river.score,
    sourceBasin: river.basin,
    flowDir: meta.flowDir,
    points: densified,
    extraPolylines: joined.slice(1).map((line) => line.map(([lon, lat]) => ({ lat, lon })))
  };
}

// === 通用 OSM 河流拼接器 ===
// 把 OSM 同名 way 拼成单 polyline。flowDir + sort 修 greedy join 跳序。
// densify 让 carving 覆盖整段。
function stitchOsmRiverByName({
  osm,
  riverName,
  corridor, // bbox or null
  joinTolerance = 0.05,
  flowDir = "lat-desc",
  densifyTolDeg = 0.018,
  minSegPts = 4
}) {
  const segs = osm.features
    .filter((f) => f.name === riverName && f.geometry?.points?.length >= 2)
    .map((f) =>
      f.geometry.points.map((p) => {
        const geo = unprojectWorldToGeo(p);
        return [geo.lon, geo.lat];
      })
    )
    .filter((line) =>
      !corridor ||
      line.some(
        ([lon, lat]) =>
          lon >= corridor.west &&
          lon <= corridor.east &&
          lat >= corridor.south &&
          lat <= corridor.north
      )
    );
  if (segs.length === 0) return null;
  const clipped = [];
  for (const line of segs) clipped.push(...clipPolyline(line, SLICE_BBOX));
  if (clipped.length === 0) return null;
  const joined = joinPolylines(clipped, joinTolerance);
  joined.sort((a, b) => b.length - a.length);
  const primary = joined[0];
  if (primary.length < minSegPts) return null;
  const sorted = sortByFlowDir(primary, flowDir);
  const points = densifyPolylineLatLon(
    sorted.map(([lon, lat]) => ({ lat, lon })),
    densifyTolDeg
  );
  return { points, segCount: segs.length, joinedCount: joined.length };
}

// === OSM 上游岷江 (NE 10m 没收) ===
// 现有的 hand-typed river-minjiang 只从 都江堰 (~30.99°N) 往南 5 个点，
// 完全缺失 松潘 → 汶川 → 都江堰 这段上游。OSM 里有 35 段 way 都叫"岷江"，
// 反投回 lat/lon 后 greedy join + clip 到 slice 上游廊道，拼出主干。
//
// ⚠️ 名字冲突：甘肃也有一条"岷江"（嘉陵江上游支流，lon 104.3-104.8）。
// 通过 bbox 把它过滤掉。
const SICHUAN_MIN_CORRIDOR = { west: 103.4, east: 104.0, south: 30.4, north: 33.5 };
const osm = JSON.parse(await fs.readFile(OSM_PATH, "utf8"));
const minjiangSegs = osm.features
  .filter((f) => f.name === "岷江" && f.geometry?.points?.length >= 2)
  .map((f) =>
    f.geometry.points.map((p) => {
      const geo = unprojectWorldToGeo(p);
      return [geo.lon, geo.lat];
    })
  )
  // 过滤掉甘肃岷江 (要求 way 至少有一个点落在四川岷江廊道里)
  .filter((line) =>
    line.some(
      ([lon, lat]) =>
        lon >= SICHUAN_MIN_CORRIDOR.west &&
        lon <= SICHUAN_MIN_CORRIDOR.east &&
        lat >= SICHUAN_MIN_CORRIDOR.south &&
        lat <= SICHUAN_MIN_CORRIDOR.north
    )
  );
console.log(`\n岷江(OSM): ${minjiangSegs.length} 个 way 段（已过滤甘肃岷江）`);
const minClipped = [];
for (const line of minjiangSegs) {
  minClipped.push(...clipPolyline(line, SLICE_BBOX));
}
// 都江堰附近 OSM 数据有 ~37km 缺口（映秀-都江堰段缺数据），
// 用 0.5° (~50km) 容差跨过去把上下游缝起来
const minJoined = joinPolylines(minClipped, 0.5);
minJoined.sort((a, b) => b.length - a.length);
const minPrimary = minJoined[0] || [];
// 修缝完后保险起见再按廊道 bbox 过滤一遍残留小段
const minExtras = minJoined.slice(1).filter(
  (line) => line.length >= 4 && line.every(
    ([lon, lat]) =>
      lon >= SICHUAN_MIN_CORRIDOR.west &&
      lon <= SICHUAN_MIN_CORRIDOR.east &&
      lat >= SICHUAN_MIN_CORRIDOR.south &&
      lat <= SICHUAN_MIN_CORRIDOR.north
  )
);
console.log(
  `  ${minClipped.length} clipped → ${minJoined.length} joined → primary ${minPrimary.length} pts + ${minExtras.length} extra`
);
if (minPrimary.length > 0) {
  // OSM 的 "岷江" 在 都江堰 dam 处停 (下游分流成 内江/外江)，
  // 但游戏需要主干一直到南边盆地。手画 bridge 点沿 汶川→映秀→都江堰
  // 真实廊道补 (避免 1 个稀疏点连出 47km 直线穿 卧龙山区)，然后保留
  // 原 hand-typed 5 个南向点 (都江堰 → 双流 → 黄龙溪)。
  const bridgeAndDownstream = [
    { lat: 31.483, lon: 103.59 },     // 汶川县城
    { lat: 31.42, lon: 103.535 },     // 银杏乡
    { lat: 31.36, lon: 103.50 },      // 耿达乡 (卧龙保护区入口)
    { lat: 31.27, lon: 103.48 },      // 沙坪
    { lat: 31.20, lon: 103.485 },     // 草坡
    { lat: 31.10, lon: 103.49 },      // 映秀镇北
    { lat: 31.07, lon: 103.49 },      // 映秀镇
    { lat: 31.02, lon: 103.55 },      // 紫坪铺水库
    { lat: 30.98333, lon: 103.62222 }, // 都江堰 渠首 (原 hand-typed 起点)
    { lat: 30.92083, lon: 103.68333 },
    { lat: 30.8375, lon: 103.80556 },
    { lat: 30.75417, lon: 103.92778 },
    { lat: 30.66042, lon: 104.06528 }
  ];
  // greedy join 不保证 traversal order — OSM 子段被反向拼接时会产生
  // out-of-order 跳点 (实测 i=2062 lat 31.365 → i=2063 lat 31.016 → i=2114
  // lat 31.481，整段 ribbon 来回跳，渲染成横穿山脉的直线)。
  // 岷江 N→S 单向流，fix：合并 bridge 后按 lat 降序排，强制按真实流向。
  const merged = [
    ...minPrimary.map(([lon, lat]) => ({ lat, lon })),
    ...bridgeAndDownstream
  ];
  merged.sort((a, b) => b.lat - a.lat); // 北→南
  // 密化 (~2km)：南端 hand-typed bridge 太稀，让 carving 覆盖 都江堰 → 成都 → 黄龙溪 整段
  const densified = densifyPolylineLatLon(merged, 0.018);
  result["river-minjiang"] = {
    name: "岷江",
    sourceScore: 9,
    sourceBasin: "yangtze",
    sourceData: "openstreetmap-overpass + manual bridge across 都江堰 dam, sorted N→S, densified ~2km",
    points: densified,
    extraPolylines: minExtras.map((line) => line.map(([lon, lat]) => ({ lat, lon })))
  };
}

// === OSM 拼接小支流 (褒河 + 内江) ===
// hand-typed 4-5 控制点稀疏，atlas verification 也不通过。OSM 有真实
// 矢量；拼出来同步 source 升级到 external-vector，让 atlas 默认 overview
// 也能看到这些小溪。
const SMALL_TRIB_OSM_TARGETS = [
  {
    id: "stream-baohe",
    osmName: "褒河",
    flowDir: "lat-desc", // 秦岭 N → 汉中 S 入 汉水
    // 实测 OSM 褒河 在 lon 107.55-107.66 (不在我之前以为的 汉中 附近 106.5-107.3)
    corridor: { west: 107.4, east: 107.8, south: 32.9, north: 34.1 }
  },
  {
    id: "river-neijiang",
    osmName: "内江",
    flowDir: "lat-desc", // 都江堰 渠首 → 成都 经 内江 灌渠
    corridor: { west: 103.4, east: 104.3, south: 30.5, north: 31.1 }
  }
];

console.log("\n=== 小支流 OSM 拼接 ===");
for (const target of SMALL_TRIB_OSM_TARGETS) {
  const stitched = stitchOsmRiverByName({
    osm,
    riverName: target.osmName,
    corridor: target.corridor,
    flowDir: target.flowDir,
    joinTolerance: 0.05
  });
  if (!stitched) {
    console.log(`  ${target.osmName.padEnd(4)}  ⚠️  OSM 没有可用 polyline`);
    continue;
  }
  console.log(`  ${target.osmName.padEnd(4)}  ${stitched.segCount} OSM seg → ${stitched.points.length} pts (joined ${stitched.joinedCount})`);
  result[target.id] = {
    name: target.osmName,
    sourceScore: 5, // 小支流默认分
    sourceBasin: "yangtze",
    sourceData: "openstreetmap-overpass",
    flowDir: target.flowDir,
    points: stitched.points,
    extraPolylines: []
  };
}

const banner = `// AUTO-GENERATED by scripts/build-qinling-hydrography-from-ne.mjs — 不要手改。
// 数据源: Natural Earth 10m rivers + OSM Overpass (public domain)
// Slice bbox: ${SLICE_BBOX.west}°-${SLICE_BBOX.east}°E, ${SLICE_BBOX.south}°-${SLICE_BBOX.north}°N
// 跑 \`node scripts/build-qinling-hydrography-from-ne.mjs\` 重新生成。
`;

await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
await fs.writeFile(
  OUT_PATH,
  `${banner}export const qinlingNeRivers = ${JSON.stringify(result, null, 2)};\n`,
  "utf8"
);
console.log(`\n输出 ${OUT_PATH}`);
console.log(`总计: ${totalIn} 输入 → ${totalOut} 裁剪后 (${Object.keys(result).length} 条河)`);
