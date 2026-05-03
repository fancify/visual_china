#!/usr/bin/env node
// 把全国 NE 数据里跟秦岭切片相关的 4 条主河 (渭河/汉水/嘉陵江/岷江)
// clip 到 slice bbox，写出 src/game/data/qinlingNeRivers.js
//
// 这一步是把 hand-typed 4-5 控制点的"折线骨架"换成 NE 10m 真实曲线。
// 小支流 (褒水/斜水/外江/内江) NE 没有，留在 qinlingHydrography.js 里手动维护。
//
// Usage: node scripts/build-qinling-hydrography-from-ne.mjs

import fs from "node:fs/promises";
import path from "node:path";

const RIVERS_PATH = path.resolve("public/data/china/major-rivers.json");
const OUT_PATH = path.resolve("src/game/data/qinlingNeRivers.js");

// 切片范围
const SLICE_BBOX = { west: 103.5, east: 110, south: 30.4, north: 35.4 };

// NE name → 我们 game 的 river id 映射
const NAME_TO_ID = {
  "渭河": "river-weihe",
  "汉水": "river-hanjiang",
  "嘉陵江": "river-jialingjiang",
  "岷江": "river-minjiang"
};

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
  const id = NAME_TO_ID[river.name];
  if (!id) continue;
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
  const primary = joined[0];
  result[id] = {
    name: river.name,
    sourceScore: river.score,
    sourceBasin: river.basin,
    points: primary.map(([lon, lat]) => ({ lat, lon })),
    extraPolylines: joined.slice(1).map((line) => line.map(([lon, lat]) => ({ lat, lon })))
  };
}

const banner = `// AUTO-GENERATED by scripts/build-qinling-hydrography-from-ne.mjs — 不要手改。
// 数据源: Natural Earth 10m rivers (public domain)
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
