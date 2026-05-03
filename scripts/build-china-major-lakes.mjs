#!/usr/bin/env node
// 全国主要湖泊"评分 + 真实 polygon"构建脚本——跟 build-china-major-rivers.mjs
// 同思路，输出 public/data/china/major-lakes.json。
//
// 数据：Natural Earth 10m lakes (public domain, ~7000 features)
//
// Usage: node scripts/build-china-major-lakes.mjs

import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

const NE_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes.geojson";
const NE_CACHE_DIR = path.resolve("data/natural-earth");
const NE_LAKES_PATH = path.join(NE_CACHE_DIR, "ne_10m_lakes.geojson");
const OUT_PATH = path.resolve("public/data/china/major-lakes.json");

// 18 个湖泊 = 用户已选 8 + 推荐 10。score 同 rivers 公式：(4-trunk)*3 + story
// trunk 这里复用：1 = 国家级（五大淡水湖、青藏高原圣湖、边境/民族湖），
// 2 = 区域知名湖。area 暂不打分（湖泊大小没那么主导话语权），后续可加。
const LAKE_RUBRIC = [
  // 五大淡水湖（按面积排序：鄱阳-洞庭-太湖-洪泽-巢湖）
  { id: "poyang",   name: "鄱阳湖",    region: "south",   trunk: 1, story: 5, neNames: ["Poyang Hu", "Poyang"], note: "中国第一大淡水湖，江西母亲湖，候鸟越冬地。" },
  { id: "dongting", name: "洞庭湖",    region: "south",   trunk: 1, story: 5, neNames: ["Dongting Hu", "Dongting"], note: "湘北门户，岳阳楼，《岳阳楼记》范仲淹。" },
  { id: "taihu",    name: "太湖",      region: "east",    trunk: 1, story: 5, neNames: ["Tai Hu", "Lake Tai"], note: "江南水乡核心，姑苏-无锡-湖州金三角。" },
  { id: "hongze",   name: "洪泽湖",    region: "east",    trunk: 1, story: 4, neNames: ["Hongze Hu", "Hongze"], note: "第四大淡水湖，淮河入湖处，明清治淮核心。" },
  { id: "chaohu",   name: "巢湖",      region: "east",    trunk: 1, story: 4, neNames: ["Chao Hu", "Chao"], note: "第五大淡水湖，合肥南，曹操巢湖练水军。" },

  // 西部高原圣湖
  { id: "qinghai",  name: "青海湖",    region: "qinghai", trunk: 1, story: 5, neNames: ["Qinghai Hu", "Koko Nor"], note: "中国最大咸水湖，藏蒙圣湖，唐蕃古道。" },
  { id: "namtso",   name: "纳木错",    region: "tibet",   trunk: 1, story: 4, neNames: ["Nam Co", "Namtso"], note: "西藏三大圣湖之一，念青唐古拉北麓。" },
  { id: "yamdrok",  name: "羊卓雍措",  region: "tibet",   trunk: 1, story: 4, neNames: ["Yamzho Yumco", "Yamdrok"], note: "西藏三大圣湖，山南，蓝绿宝石形状。" },
  { id: "manasarovar", name: "玛旁雍措", region: "tibet", trunk: 1, story: 5, neNames: ["Manasarovar", "Mapam Yumco"], note: "藏传 + 印度教共同圣湖，雅江/恒河/印度河源头区。" },
  // 赛里木湖 (455 km²) NE 10m 里没收，用 fallback disk
  { id: "sayram",   name: "赛里木湖",  region: "northwest", trunk: 1, story: 3, neNames: ["Sayram"], fallbackCenter: [81.18, 44.60], fallbackRadiusKm: 12, note: "天山高原蓝宝石。" },

  // 边境/民族/地理唯一
  { id: "bosten",   name: "博斯腾湖",  region: "northwest", trunk: 1, story: 3, neNames: ["Bosten Hu", "Bosten", "Baghrash Kol"], note: "中国最大内陆淡水湖，焉耆盆地。" },
  { id: "hulun",    name: "呼伦湖",    region: "northeast", trunk: 1, story: 4, neNames: ["Hulun Nuur", "Hulun Lake", "Dalai Lake"], note: "内蒙第一大淡水湖，蒙古族母亲湖。" },
  // 长白山天池 (9.8 km²) NE 10m 没收，fallback
  { id: "tianchi-cb", name: "长白山天池", region: "northeast", trunk: 1, story: 5, neNames: [], fallbackCenter: [128.075, 42.005], fallbackRadiusKm: 2.5, note: "中朝界火山口湖，鸭绿/松花/图们三江源。" },
  // 天山天池 (4.9 km²) NE 10m 没收，fallback
  { id: "tianchi-ts", name: "天山天池", region: "northwest", trunk: 1, story: 3, neNames: [], fallbackCenter: [88.123, 43.882], fallbackRadiusKm: 1.8, note: "道教瑶池神话，博格达峰。" },

  // 西南 + 华北水乡
  // 洱海 (250 km²) NE 10m 没收，fallback
  { id: "erhai",    name: "洱海",      region: "yunnan",  trunk: 1, story: 4, neNames: ["Erhai", "Er Hai"], fallbackCenter: [100.18, 25.78], fallbackRadiusKm: 9, note: "大理母亲湖，南诏国-大理国都城。" },
  // 滇池 (298 km²) NE 10m 没收，fallback
  { id: "dianchi",  name: "滇池",      region: "yunnan",  trunk: 1, story: 4, neNames: ["Dian Chi", "Dianchi", "Kunming Hu"], fallbackCenter: [102.69, 24.83], fallbackRadiusKm: 11, note: "昆明南，滇国故都，五百里滇池。" },
  // 白洋淀 (~366 km² 季节性) NE 10m 没收，fallback
  { id: "baiyangdian", name: "白洋淀", region: "north",   trunk: 1, story: 4, neNames: ["Baiyangdian"], fallbackCenter: [115.96, 38.93], fallbackRadiusKm: 11, note: "华北第一大淡水洼淀，雁翎队抗日。" },
  { id: "qiandao",  name: "千岛湖",    region: "east",    trunk: 1, story: 3, neNames: ["Xinanjiang Shuiku", "Qiandao"], note: "新安江水库，1959 年蓄水形成千余岛屿。" }
];

function score(l) { return (4 - l.trunk) * 3 + l.story; }

LAKE_RUBRIC.sort((a, b) => score(b) - score(a));

async function ensureNaturalEarth() {
  await fs.mkdir(NE_CACHE_DIR, { recursive: true });
  try {
    await fs.access(NE_LAKES_PATH);
    return;
  } catch {}
  console.log(`下载 Natural Earth 10m lakes → ${NE_LAKES_PATH}`);
  execSync(`curl -L --fail --silent --show-error -o "${NE_LAKES_PATH}" "${NE_URL}"`, {
    stdio: "inherit"
  });
}

function bboxOfPolygon(coords) {
  // coords = [[[lon, lat], ...], ...] (outer + holes)
  let west = Infinity, east = -Infinity, south = Infinity, north = -Infinity;
  coords[0].forEach(([lon, lat]) => {
    if (lon < west) west = lon;
    if (lon > east) east = lon;
    if (lat < south) south = lat;
    if (lat > north) north = lat;
  });
  return [west, south, east, north];
}

function bboxIntersect(a, b) {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3]);
}

// 用 fallback 中心和半径生成一个近似圆 polygon，给 NE 10m 收不进去的小湖用
function fallbackDisk(centerLon, centerLat, radiusKm, segments = 32) {
  // 1° lat ≈ 111 km；1° lon ≈ 111 * cos(lat) km
  const dLat = radiusKm / 111;
  const dLon = radiusKm / (111 * Math.cos((centerLat * Math.PI) / 180));
  const ring = [];
  for (let i = 0; i < segments; i += 1) {
    const t = (i / segments) * Math.PI * 2;
    ring.push([centerLon + Math.cos(t) * dLon, centerLat + Math.sin(t) * dLat]);
  }
  ring.push(ring[0]); // 闭合
  return [ring]; // 单 ring polygon (无洞)
}

function polygonsForLake(geojson, lake) {
  const candidates = lake.neNames.map((n) => n.toLowerCase());
  const matches = geojson.features.filter((f) => {
    const fields = [f.properties?.name, f.properties?.name_alt]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase());
    return fields.some((field) => candidates.includes(field));
  });
  if (matches.length === 0) return null;

  // bbox 消歧（如长白山天池 vs 天山天池都叫 Tianchi）
  const polygons = [];
  matches.forEach((f) => {
    const geom = f.geometry;
    if (!geom) return;
    const polys = geom.type === "Polygon"
      ? [geom.coordinates]
      : geom.type === "MultiPolygon"
        ? geom.coordinates
        : [];
    polys.forEach((poly) => {
      if (lake.bboxFilter) {
        const polyBbox = bboxOfPolygon(poly);
        if (!bboxIntersect(polyBbox, lake.bboxFilter)) return;
      }
      polygons.push(poly);
    });
  });
  return polygons.length > 0 ? polygons : null;
}

await ensureNaturalEarth();
const ne = JSON.parse(await fs.readFile(NE_LAKES_PATH, "utf8"));
console.log(`Natural Earth lakes loaded: ${ne.features.length} features`);

const out = {
  schema: "qianli-jiangshan.china-major-lakes.v1",
  generatedAt: new Date().toISOString(),
  sourceData: "Natural Earth 10m lakes (public domain)",
  selectionRubric:
    "score = (4 - trunk) * 3 + story. trunk: 1 = 国家级湖泊 / 2 = 区域知名. story: 0-5.",
  lakes: []
};

let matched = 0;
let fallbackUsed = 0;
const missing = [];
for (const l of LAKE_RUBRIC) {
  const polygons = polygonsForLake(ne, l);
  if (polygons && polygons.length > 0) {
    matched += 1;
    out.lakes.push({ ...l, score: score(l), polygons, matchedFromNE: true });
    continue;
  }
  if (l.fallbackCenter && l.fallbackRadiusKm) {
    fallbackUsed += 1;
    const disk = fallbackDisk(l.fallbackCenter[0], l.fallbackCenter[1], l.fallbackRadiusKm);
    out.lakes.push({ ...l, score: score(l), polygons: [disk], matchedFromNE: false, source: "fallback-disk" });
    continue;
  }
  missing.push(l.name);
  out.lakes.push({ ...l, score: score(l), polygons: [], matchedFromNE: false });
}

await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
await fs.writeFile(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, "utf8");
console.log(`\n输出 ${OUT_PATH}`);
console.log(`匹配 Natural Earth: ${matched}/${LAKE_RUBRIC.length}，fallback disk: ${fallbackUsed}`);
if (missing.length > 0) {
  console.log(`未匹配 (无 fallback): ${missing.join(", ")}`);
}
console.log("\n按 score 排：");
out.lakes.forEach((l) => {
  const tag = l.matchedFromNE ? "NE" : l.source === "fallback-disk" ? "disk" : "—";
  console.log(`  ${l.name.padEnd(10)} score=${l.score}  ${tag}`);
});
