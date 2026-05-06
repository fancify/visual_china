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
import { pathToFileURL } from "node:url";

import { qinlingBounds, qinlingWorld } from "./qinling-dem-common.mjs";

const RIVERS_PATH = path.resolve("public/data/china/major-rivers.json");
const OSM_PATH = path.resolve("public/data/regions/qinling/hydrography/osm-modern.json");
const OUT_PATH = path.resolve("src/game/data/qinlingNeRivers.js");

// 用于把 OSM 的 {x, y=z} 反投回 {lat, lon}
const QINLING_BOUNDS = { ...qinlingBounds };
const QINLING_WORLD = { ...qinlingWorld };
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
const SLICE_BBOX = { ...qinlingBounds };

// NE name → 我们 game 的 river id 映射 + 主流方向 + game metadata
// flowDir: "lon-asc" = W→E (lon 递增), "lon-desc" = E→W, "lat-desc" = N→S, "lat-asc" = S→N
// 凡是在 major-rivers.json 里有 polyline 进入 slice bbox 的，都列在这里。
// 之前的 斜水 / 外江 因 NE/OSM 都没数据，dropped (用户："去掉目前的河，用新做的河来代替")。
// 凡是 major-rivers.json 里有 polyline 进入 slice 的 NE 河，都列在这里。
// (黄河/岷江 在 major-rivers.json 但 NE 数据不进 slice — 黄河走太北，
// 岷江上游 NE 没收。warning 而已，不会进结果。)
const NAME_TO_ID = {
  "长江":   { id: "river-changjiang",   flowDir: "lon-asc",  rank: 1, basin: "长江流域", displayName: "长江" },
  "金沙江": { id: "river-jinshajiang", flowDir: "lon-asc",  rank: 1, basin: "长江流域", displayName: "金沙江" },
  "黄河":   { id: "river-huanghe",      flowDir: "lon-asc",  rank: 1, basin: "黄河流域", displayName: "黄河" },
  "渭河":   { id: "river-weihe",        flowDir: "lon-asc",  rank: 1, basin: "黄河流域", displayName: "渭河" },
  "汉水":   { id: "river-hanjiang",     flowDir: "lon-asc",  rank: 1, basin: "长江流域", displayName: "汉水", aliases: ["汉江"] },
  "嘉陵江": { id: "river-jialingjiang", flowDir: "lat-desc", rank: 1, basin: "长江流域", displayName: "嘉陵江" },
  "岷江":   { id: "river-minjiang",     flowDir: "lat-desc", rank: 1, basin: "长江流域", displayName: "岷江" },
  // 乌江实际流向 S→N (贵阳源 → 涪陵入长江)，旧 lon-asc 排序把多支线合并成
  // "梳齿"垂直平行条。改 lat-asc 让 polyline 沿主干 S→N 单调连。
  "乌江":   { id: "river-wujiang",      flowDir: "lat-asc",  rank: 1, basin: "长江流域", displayName: "乌江" },
  "沱江":   { id: "river-tuojiang",     flowDir: "lat-desc", rank: 2, basin: "长江流域", displayName: "沱江" },
  // 沅江流向 W→E（黔东 → 湖南），但 NE 数据本地段在 黔东 109°E 附近主要
  // 走 S→N。lat-asc 比 lon-asc 在我们 slice 里更连续。
  "沅江":   { id: "river-yuanjiang",    flowDir: "lat-asc",  rank: 2, basin: "长江流域", displayName: "沅江", aliases: ["沅水"] },
  // 江汉 / 江南东段继续东扩后新增两条关键支流。按纬度递增排序，避免
  // MultiLineString 在局部横向散开时被 lon-asc 排成 comb。
  "湘江":   { id: "river-xiangjiang",   flowDir: "lat-asc",  rank: 2, basin: "长江流域", displayName: "湘江" },
  "赣江":   { id: "river-ganjiang",     flowDir: "lat-asc",  rank: 2, basin: "长江流域", displayName: "赣江" },
  // 北扩到太行-华北平原后新增海河流域骨架，按西→东排序即可保持主干连续。
  "海河":   { id: "river-haihe",        flowDir: "lon-asc",  rank: 1, basin: "海河流域", displayName: "海河" },
  "漳河":   { id: "river-zhanghe",      flowDir: "lon-asc",  rank: 2, basin: "海河流域", displayName: "漳河" }
};

// 南扩后用户点名的几条珠江系干支流，在当前本地数据里还缺源：
// - major-rivers.json 没有 红水河 / 漓江 / 邕江
// - 当前仓库内 OSM snapshot 也没有 漓江 / 邕江，红水河仅有旧 slice 北侧局部小段，
//   不能冒充广西主干。
// 先显式记成 source gap，build 时打印 TODO，等用户补本地 OSM/curated 数据后再接。
const SOUTHERN_SOURCE_GAPS = [
  { displayName: "红水河", aliases: ["右江"], basin: "珠江流域" },
  { displayName: "漓江", aliases: [], basin: "珠江流域" },
  { displayName: "邕江", aliases: [], basin: "珠江流域" }
];

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

function pointDistance([lonA, latA], [lonB, latB]) {
  return Math.hypot(lonA - lonB, latA - latB);
}

export function polylineLength(points) {
  let total = 0;
  for (let i = 1; i < points.length; i += 1) {
    total += pointDistance(points[i - 1], points[i]);
  }
  return total;
}

function flowProjection([lon, lat], flowDir) {
  switch (flowDir) {
    case "lon-asc":
    case "lon-desc":
      return lon;
    case "lat-asc":
    case "lat-desc":
      return lat;
    default:
      return lat;
  }
}

function shouldReverseByFlowDir(line, flowDir) {
  if (line.length < 2) return false;
  const head = line[0];
  const tail = line[line.length - 1];
  const headProjection = flowProjection(head, flowDir);
  const tailProjection = flowProjection(tail, flowDir);
  if (flowDir.endsWith("asc")) return headProjection > tailProjection;
  return headProjection < tailProjection;
}

function orientPolylineByFlowDir(line, flowDir) {
  const oriented = line.slice();
  if (shouldReverseByFlowDir(oriented, flowDir)) oriented.reverse();
  return oriented;
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

function perpendicularDistanceSq(point, segmentStart, segmentEnd) {
  const dx = segmentEnd.lon - segmentStart.lon;
  const dy = segmentEnd.lat - segmentStart.lat;
  if (dx === 0 && dy === 0) {
    return (point.lon - segmentStart.lon) ** 2 + (point.lat - segmentStart.lat) ** 2;
  }
  const t =
    ((point.lon - segmentStart.lon) * dx + (point.lat - segmentStart.lat) * dy) /
    (dx * dx + dy * dy);
  const clamped = Math.max(0, Math.min(1, t));
  const projectedLon = segmentStart.lon + clamped * dx;
  const projectedLat = segmentStart.lat + clamped * dy;
  return (point.lon - projectedLon) ** 2 + (point.lat - projectedLat) ** 2;
}

export function simplifyPolyline(points, toleranceDeg = 0.01) {
  if (points.length <= 2) return points.slice();
  const sqTolerance = toleranceDeg * toleranceDeg;
  const keep = new Set([0, points.length - 1]);

  function rdp(startIndex, endIndex) {
    let maxDistance = 0;
    let maxIndex = -1;
    for (let i = startIndex + 1; i < endIndex; i += 1) {
      const distance = perpendicularDistanceSq(points[i], points[startIndex], points[endIndex]);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }
    if (maxDistance > sqTolerance && maxIndex !== -1) {
      keep.add(maxIndex);
      rdp(startIndex, maxIndex);
      rdp(maxIndex, endIndex);
    }
  }

  rdp(0, points.length - 1);
  return [...keep]
    .sort((a, b) => a - b)
    .map((index) => points[index]);
}

function buildNeRiverGeometryFromClipped(
  clipped,
  {
    flowDir,
    chainThresholdDeg = 0.5,
    // 旧版 max=2 让 汉水 4 个 sub-polyline 接不全（Part 1 汉中源 被丢出 extras）。
    // 上调到 8 → 长河（汉水/长江/嘉陵江）的所有上下游连续段都能 chain 进主干。
    maxChainedExtras = 8,
    densifyMaxDeg = 0.018,
    simplifyToleranceDeg = 0.01
  }
) {
  if (clipped.length === 0) return null;
  const oriented = clipped
    .map((line) => orientPolylineByFlowDir(line, flowDir))
    .sort((a, b) => polylineLength(b) - polylineLength(a));
  const { primaryLine, extraLines } = chainNearbySubLines(
    oriented,
    chainThresholdDeg,
    maxChainedExtras
  );
  const toLatLon = (line) => line.map(([lon, lat]) => ({ lat, lon }));
  return {
    points: simplifyPolyline(
      densifyPolylineLatLon(toLatLon(primaryLine), densifyMaxDeg),
      simplifyToleranceDeg
    ),
    extraPolylines: extraLines.map((line) =>
      simplifyPolyline(
        densifyPolylineLatLon(toLatLon(line), densifyMaxDeg),
        simplifyToleranceDeg
      )
    ),
    primaryLengthDeg: polylineLength(primaryLine)
  };
}

export function buildNeRiverGeometry(
  river,
  {
    flowDir,
    chainThresholdDeg = 0.5,
    // 旧版 max=2 让 汉水 4 个 sub-polyline 接不全（Part 1 汉中源 被丢出 extras）。
    // 上调到 8 → 长河（汉水/长江/嘉陵江）的所有上下游连续段都能 chain 进主干。
    maxChainedExtras = 8,
    clipBbox = SLICE_BBOX,
    densifyMaxDeg = 0.018,
    simplifyToleranceDeg = 0.01
  }
) {
  const clipped = [];
  for (const line of river.polylines ?? []) {
    clipped.push(...clipPolyline(line, clipBbox));
  }
  return buildNeRiverGeometryFromClipped(clipped, {
    flowDir,
    chainThresholdDeg,
    maxChainedExtras,
    densifyMaxDeg,
    simplifyToleranceDeg
  });
}

function findBestEndpointJoin(seed, candidate) {
  const seedHead = seed[0];
  const seedTail = seed[seed.length - 1];
  const candidateHead = candidate[0];
  const candidateTail = candidate[candidate.length - 1];
  const joins = [
    {
      distance: pointDistance(seedHead, candidateHead),
      side: "head",
      candidatePoints: candidate.slice().reverse()
    },
    {
      distance: pointDistance(seedHead, candidateTail),
      side: "head",
      candidatePoints: candidate.slice()
    },
    {
      distance: pointDistance(seedTail, candidateHead),
      side: "tail",
      candidatePoints: candidate.slice()
    },
    {
      distance: pointDistance(seedTail, candidateTail),
      side: "tail",
      candidatePoints: candidate.slice().reverse()
    }
  ];
  joins.sort((a, b) => a.distance - b.distance);
  return joins[0];
}

function chainNearbySubLines(lines, thresholdDeg, maxChainedExtras) {
  if (lines.length === 0) {
    return { primaryLine: null, extraLines: [] };
  }
  const [seedLine, ...remainingLines] = lines.map((line) => line.slice());
  const primaryLine = seedLine.slice();
  let chainedExtras = 0;

  while (remainingLines.length > 0 && chainedExtras < maxChainedExtras) {
    const rankedCandidates = remainingLines
      .map((candidate, index) => ({
        index,
        candidate,
        join: findBestEndpointJoin(primaryLine, candidate)
      }))
      .sort((a, b) => a.join.distance - b.join.distance);
    const best = rankedCandidates[0];
    if (!best || best.join.distance > thresholdDeg) break;

    if (best.join.side === "head") {
      primaryLine.unshift(...best.join.candidatePoints);
    } else {
      primaryLine.push(...best.join.candidatePoints);
    }
    remainingLines.splice(best.index, 1);
    chainedExtras += 1;
  }

  return {
    primaryLine,
    extraLines: remainingLines
  };
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

async function main() {
  const data = JSON.parse(await fs.readFile(RIVERS_PATH, "utf8"));
  const sourceRiverNames = new Set(data.rivers.map((river) => river.name));
  for (const gap of SOUTHERN_SOURCE_GAPS) {
    const hasLocalSource =
      sourceRiverNames.has(gap.displayName) ||
      gap.aliases.some((alias) => sourceRiverNames.has(alias));
    if (!hasLocalSource) {
      console.log(
        `TODO(source-gap): ${gap.displayName} (${gap.basin}) 缺本地主河源数据；待用户补 OSM/curated geometry`
      );
    }
  }
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
    const geometry = buildNeRiverGeometryFromClipped(clipped, {
      flowDir: meta.flowDir
    });
    console.log(
      `${river.name.padEnd(6)}  ${river.polylines.length} polyline(s) ${inPoints} pts → ${clipped.length} clipped → primary ${geometry.points.length} pts + ${geometry.extraPolylines.length} extras (longest ${geometry.primaryLengthDeg.toFixed(3)}°)`
    );
    result[meta.id] = {
      name: river.name,
      displayName: meta.displayName,
      aliases: meta.aliases ?? [],
      rank: meta.rank,
      basin: meta.basin,
      sourceScore: river.score,
      sourceBasin: river.basin,
      flowDir: meta.flowDir,
      points: geometry.points,
      extraPolylines: geometry.extraPolylines
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
  densifyTolDeg = 0.028,
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

// 当前扩区需求只要求补齐 major-rivers.json / NE 进入新 slice 的主干河流；
// OSM 拼接器先留着作为岷江上游/小支流补洞工具，默认关闭。
const SKIP_OSM_STITCHING = true;

// === OSM 上游岷江 (NE 10m 没收) ===
// 现有的 hand-typed river-minjiang 只从 都江堰 (~30.99°N) 往南 5 个点，
// 完全缺失 松潘 → 汶川 → 都江堰 这段上游。OSM 里有 35 段 way 都叫"岷江"，
// 反投回 lat/lon 后 greedy join + clip 到 slice 上游廊道，拼出主干。
//
// ⚠️ 名字冲突：甘肃也有一条"岷江"（嘉陵江上游支流，lon 104.3-104.8）。
// 通过 bbox 把它过滤掉。
const SICHUAN_MIN_CORRIDOR = { west: 103.4, east: 104.0, south: 30.4, north: 33.5 };
let osm = null;
if (!SKIP_OSM_STITCHING) {
  osm = JSON.parse(await fs.readFile(OSM_PATH, "utf8"));
}
const minjiangSegs = SKIP_OSM_STITCHING ? [] : osm.features
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
  const densifiedRaw = densifyPolylineLatLon(merged, 0.028);
  // 映秀镇 (31.07, 103.49) 桥点在 slice west bound (103.5) 外侧 0.01°，
  // densify 完后有 18 个插值点也在 slice 外。clip 回 slice bbox 内。
  const densified = densifiedRaw.filter(
    (p) =>
      p.lon >= SLICE_BBOX.west &&
      p.lon <= SLICE_BBOX.east &&
      p.lat >= SLICE_BBOX.south &&
      p.lat <= SLICE_BBOX.north
  );
  result["river-minjiang"] = {
    name: "岷江",
    displayName: "岷江",
    aliases: [],
    rank: 1,
    basin: "长江流域",
    flowDir: "lat-desc",
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
    displayName: "褒水",
    aliases: ["褒河"],
    rank: 3,
    basin: "汉江流域",
    flowDir: "lat-desc", // 秦岭 N → 汉中 S 入 汉水
    // 实测 OSM 褒河 在 lon 107.55-107.66 (不在我之前以为的 汉中 附近 106.5-107.3)
    corridor: { west: 107.4, east: 107.8, south: 32.9, north: 34.1 }
  },
  {
    id: "river-neijiang",
    osmName: "内江",
    displayName: "内江",
    aliases: [],
    rank: 3,
    basin: "都江堰灌渠",
    flowDir: "lat-desc", // 都江堰 渠首 → 成都 经 内江 灌渠
    corridor: { west: 103.4, east: 104.3, south: 30.5, north: 31.1 }
  }
];

console.log("\n=== 小支流 OSM 拼接 ===");
if (SKIP_OSM_STITCHING) {
  console.log("  (跳过 — 用户：只要 prototype 里有的)");
}
for (const target of SKIP_OSM_STITCHING ? [] : SMALL_TRIB_OSM_TARGETS) {
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
    displayName: target.displayName,
    aliases: target.aliases,
    rank: target.rank,
    basin: target.basin,
    flowDir: target.flowDir,
    sourceScore: 5, // 小支流默认分
    sourceData: "openstreetmap-overpass",
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
}

const isCliEntrypoint =
  process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isCliEntrypoint) {
  await main();
}
