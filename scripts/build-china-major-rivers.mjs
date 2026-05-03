#!/usr/bin/env node
// 全国主干河流"评分 + 真实 polyline"构建脚本。
//
// 流程：
// 1. 评分表（这个文件下方的 RIVER_RUBRIC 数组）按 干支级别 / 流域面积 /
//    历史意义 给每条候选河流打分，sortBy total 选出 top N。
// 2. 从 Natural Earth 10m rivers + lake centerlines（public domain）
//    下载 GeoJSON，按名字匹配，把真实 polyline 绑到每条 rubric 河流。
// 3. 输出 public/data/china/major-rivers.json 给 china-rivers prototype
//    + 未来 china-lowres demo 使用。
//
// Natural Earth 数据：
//   https://naciscdn.org/naturalearth/10m/physical/ne_10m_rivers_lake_centerlines.zip
//   (~400KB，含全球 ~1500 条 named river polyline，每条 50-2000 点)
//
// Usage: node scripts/build-china-major-rivers.mjs

import fs from "node:fs/promises";
import path from "node:path";
import { execSync } from "node:child_process";

// Natural Earth 官方 CDN (naciscdn.org) 不直接提供 .geojson，只有 .zip + shp。
// 用 nvkelso/natural-earth-vector GitHub 镜像，里面预导出了 GeoJSON。
const NE_URL =
  "https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_rivers_lake_centerlines.geojson";
const NE_CACHE_DIR = path.resolve("data/natural-earth");
const NE_RIVERS_PATH = path.join(NE_CACHE_DIR, "ne_10m_rivers.geojson");
const OUT_PATH = path.resolve("public/data/china/major-rivers.json");

// ============================================================
// 河流评分表（rubric）
// 维度：
//   trunk: 1 = 干流, 2 = 一级支流, 3 = 二级支流（分越小越主）
//   area:  5 = >1M km², 4 = >100k, 3 = >10k, 2 = >1k, 1 = <1k
//   story: 0-5（华夏文明源 5；朝代核心地 5；南北分界 4；重大战事 4；
//           漕运经济 4；地方文化 3；较少叙事 1-2）
//   neNames: Natural Earth `name` / `name_alt` 字段可能用的英文名（多个候选）
// 总分 = (4 - trunk) + area + story  → 范围 1+1+0=2 到 3+5+5=13
// ============================================================
// neNames 用 NE 实际命名（多无"江/河"后缀，韦氏拼音）。bboxFilter 在
// 同名河消歧时用：[west, south, east, north]，匹配项必须有点落在框内。
const RIVER_RUBRIC = [
  // ===== 干流（七大水系 + 国际大河）=====
  { id: "yangtze",     name: "长江",       basin: "yangtze",   trunk: 1, area: 5, story: 5, neNames: ["Yangtze", "Chang Jiang"], note: "南北经济文化纽带，三国/六朝/南宋/今日经济带核心。" },
  { id: "yellow",      name: "黄河",       basin: "yellow",    trunk: 1, area: 5, story: 5, neNames: ["Huang"], note: "华夏文明发源，夏商周秦汉唐核心，北方农业基底。" },
  { id: "pearl-xi",    name: "西江",       basin: "pearl",     trunk: 1, area: 4, story: 3, neNames: ["Xi"], bboxFilter: [102, 21, 114, 26], note: "珠江主干，岭南门户，秦瓯越南越国。" },
  { id: "heilong",     name: "黑龙江",     basin: "northeast", trunk: 1, area: 5, story: 4, neNames: ["Amur", "Heilong Jiang"], note: "中俄界河，《尼布楚/瑷珲条约》，闯关东边疆。" },
  { id: "songhua",     name: "松花江",     basin: "northeast", trunk: 1, area: 4, story: 4, neNames: ["Songhua"], note: "东北腹地母亲河，金朝发源，闯关东核心。" },
  { id: "yarlung",     name: "雅鲁藏布江", basin: "tibet",     trunk: 1, area: 4, story: 4, neNames: ["Brahmaputra", "Yarlung", "Maquan"], note: "藏地核心，吐蕃王朝、雅鲁藏布大峡谷。" },
  { id: "lancang",     name: "澜沧江",     basin: "tibet",     trunk: 1, area: 3, story: 3, neNames: ["Mekong", "Lancang"], note: "东南亚母亲河上游，茶马古道、傣族文化。" },
  { id: "nujiang",     name: "怒江",       basin: "tibet",     trunk: 1, area: 3, story: 3, neNames: ["Salween", "Nu"], bboxFilter: [96, 24, 100, 33], note: "横断山三江并流，僳僳族独龙族家园。" },
  { id: "huaihe",      name: "淮河",       basin: "huai",      trunk: 1, area: 4, story: 5, neNames: ["Huai"], bboxFilter: [112, 31, 122, 35], note: "中国南北地理分界，大禹治水、宋金分界。" },
  { id: "haihe",       name: "海河",       basin: "hai",       trunk: 1, area: 3, story: 4, neNames: ["Hai"], bboxFilter: [114, 38, 119, 41], note: "京津门户，金中都/明清北京漕运。" },
  { id: "liaohe",      name: "辽河",       basin: "liao",      trunk: 1, area: 4, story: 3, neNames: ["Liao", "Xiliao"], note: "辽东母亲河，前燕/契丹辽朝/明清辽东。" },
  { id: "luanhe",      name: "滦河",       basin: "hai",       trunk: 1, area: 3, story: 3, neNames: ["Luan"], note: "河北独立入海，承德-唐山，避暑山庄。" },
  { id: "ertix",       name: "额尔齐斯河", basin: "northwest", trunk: 1, area: 4, story: 4, neNames: ["Ertix", "Ertis", "Irtysh"], note: "中国唯一注入北冰洋（鄂毕河上游），阿尔泰山。" },
  { id: "ulungur",     name: "乌伦古河",   basin: "northwest", trunk: 1, area: 2, story: 2, neNames: ["Ulungur"], note: "新疆北疆，阿尔泰南。NE 可能未含。" },
  { id: "heihe-ru",    name: "黑河/弱水",  basin: "northwest", trunk: 1, area: 3, story: 3, neNames: ["Hei He", "Edsen Gol", "Ruoshui"], note: "河西走廊，张骞凿空、居延塞。NE 可能未含。" },
  { id: "shule",       name: "疏勒河",     basin: "northwest", trunk: 2, area: 2, story: 3, neNames: ["Shule"], note: "玉门-敦煌-阳关，丝路河西门户。NE 可能未含。" },

  // ===== 长江一级支流 =====
  { id: "jinsha",      name: "金沙江",     basin: "yangtze",   trunk: 2, area: 4, story: 3, neNames: ["Jinsha"], note: "长江上游正源段，攀枝花-宜宾。" },
  { id: "yalong",      name: "雅砻江",     basin: "yangtze",   trunk: 2, area: 3, story: 2, neNames: ["Yalong"], note: "川西第一大支，水电富集。" },
  { id: "tuojiang",    name: "沱江",       basin: "yangtze",   trunk: 2, area: 3, story: 4, neNames: ["Tuo"], bboxFilter: [103, 28, 106, 31], note: "蜀地除岷江外第二轴，成都-泸州，抗战大后方运输。" },
  { id: "minjiang",    name: "岷江",       basin: "yangtze",   trunk: 2, area: 3, story: 5, neNames: ["Min"], bboxFilter: [102, 28, 105, 33], note: "都江堰 + 成都平原灌溉，秦汉天府之国根基。" },
  { id: "dadu",        name: "大渡河",     basin: "yangtze",   trunk: 2, area: 3, story: 3, neNames: ["Dadu"], note: "强渡大渡河（红军长征）。" },
  { id: "jialing",     name: "嘉陵江",     basin: "yangtze",   trunk: 2, area: 3, story: 4, neNames: ["Jialing"], note: "蜀道金牛-米仓道沿江，三国蜀汉补给线。" },
  { id: "wujiang",     name: "乌江",       basin: "yangtze",   trunk: 2, area: 3, story: 4, neNames: ["Wu"], bboxFilter: [104, 26, 110, 30], note: "黔北门户，遵义会议、霸王别姬乌江自刎。" },
  { id: "hanshui",     name: "汉水",       basin: "yangtze",   trunk: 2, area: 4, story: 5, neNames: ["Han"], bboxFilter: [105, 30, 115, 34], note: "刘邦汉中起家，诸葛六出祁山补给，南水北调中线。" },
  { id: "xiangjiang",  name: "湘江",       basin: "yangtze",   trunk: 2, area: 3, story: 4, neNames: ["Xiang"], bboxFilter: [110, 24, 114, 30], note: "楚文化核心，岳麓书院、湖湘士人。" },
  { id: "yuanjiang",   name: "沅江",       basin: "yangtze",   trunk: 2, area: 3, story: 2, neNames: ["Yuan"], bboxFilter: [108, 26, 113, 30], note: "湘西门户，沈从文《边城》。" },
  { id: "ganjiang",    name: "赣江",       basin: "yangtze",   trunk: 2, area: 3, story: 3, neNames: ["Gan"], note: "江西母亲河，宋明两代士林、江右商帮。" },

  // ===== 黄河支流 =====
  { id: "weihe",       name: "渭河",       basin: "yellow",    trunk: 2, area: 3, story: 5, neNames: ["Wei"], bboxFilter: [104, 33, 111, 36], note: "周秦汉唐都城轴线（咸阳-长安），关中平原。" },
  { id: "fenhe",       name: "汾河",       basin: "yellow",    trunk: 2, area: 3, story: 4, neNames: ["Fen"], note: "晋国/北朝/唐河东节度使，太原-临汾。" },
  { id: "qinhe",       name: "沁河",       basin: "yellow",    trunk: 2, area: 2, story: 3, neNames: ["Qin"], bboxFilter: [111, 34, 114, 37], note: "晋东南-豫北通道，元末沁水驿站。" },
  { id: "luohe",       name: "洛河",       basin: "yellow",    trunk: 2, area: 3, story: 5, neNames: ["Luo"],  bboxFilter: [109, 33, 113, 35], note: "夏商周洛邑、东汉洛阳、隋唐东都，洛书。NE 可能未含。" },
  { id: "huangshui",   name: "湟水",       basin: "yellow",    trunk: 2, area: 2, story: 3, neNames: ["Huangshui", "Huang Shui"], note: "西宁河，唐蕃古道。NE 可能未含。" },

  // ===== 珠江支流 =====
  { id: "beijiang",    name: "北江",       basin: "pearl",     trunk: 2, area: 3, story: 3, neNames: ["Bei"], bboxFilter: [112, 22, 115, 26], note: "粤北脊柱，南雄-韶关-广州古驿。" },
  { id: "dongjiang",   name: "东江",       basin: "pearl",     trunk: 2, area: 3, story: 3, neNames: ["Dong"], bboxFilter: [113, 22, 116, 26], note: "客家母亲河，深港供水。" },
  { id: "liujiang",    name: "柳江",       basin: "pearl",     trunk: 2, area: 3, story: 2, neNames: ["Liu"], bboxFilter: [108, 23, 110, 26], note: "广西腹地，柳宗元贬地。" },
  { id: "hanjiang-east", name: "韩江",     basin: "southeast", trunk: 2, area: 2, story: 3, neNames: ["Han"], bboxFilter: [115.5, 23, 117, 25], note: "潮汕母亲河，韩愈贬潮州。" },

  // ===== 东南诸河 =====
  { id: "minjiang-fj", name: "闽江",       basin: "southeast", trunk: 1, area: 3, story: 3, neNames: ["Min"], bboxFilter: [117, 25, 120, 28], note: "福建母亲河，闽国闽都福州。" },
  { id: "qiantang",    name: "钱塘江",     basin: "southeast", trunk: 1, area: 3, story: 4, neNames: ["Fuchun"], note: "杭州门户，南宋临安、钱塘潮、伍子胥。" },
  { id: "oujiang",     name: "瓯江",       basin: "southeast", trunk: 2, area: 2, story: 2, neNames: ["Ou"], bboxFilter: [118, 27, 121, 29], note: "温州母亲河，东瓯国。" },

  // ===== 西北内陆 =====
  { id: "tarim",       name: "塔里木河",   basin: "northwest", trunk: 1, area: 4, story: 4, neNames: ["Tarim"], note: "丝绸之路南线沿河，楼兰罗布泊。" },
  { id: "yarkand",     name: "叶尔羌河",   basin: "northwest", trunk: 2, area: 3, story: 2, neNames: ["Yarkant"], note: "南疆喀什-叶尔羌汗国。" },
  { id: "hotan",       name: "和田河",     basin: "northwest", trunk: 2, area: 3, story: 3, neNames: ["Yurungkax"], note: "和田玉、佛教于阗国（白玉河）。" },
  { id: "aksu",        name: "阿克苏河",   basin: "northwest", trunk: 2, area: 2, story: 2, neNames: ["Aksu"], note: "塔里木河北源。" },

  // ===== 东北其它 =====
  { id: "nenjiang",    name: "嫩江",       basin: "northeast", trunk: 2, area: 4, story: 3, neNames: ["Nen"], note: "蒙古-达斡尔-鄂温克交汇，齐齐哈尔。" },
  { id: "wusuli",      name: "乌苏里江",   basin: "northeast", trunk: 2, area: 3, story: 3, neNames: ["Ussuri"], note: "中俄界河，珍宝岛事件。" },
  { id: "yalujiang",   name: "鸭绿江",     basin: "northeast", trunk: 2, area: 3, story: 5, neNames: ["Yalu"], note: "中朝界河，明朝萨尔浒、抗美援朝。" },
  { id: "tumen",       name: "图们江",     basin: "northeast", trunk: 2, area: 2, story: 3, neNames: ["Tumen"], note: "中朝俄交汇，朝鲜族故地。" },

  // ===== 国际河 =====
  { id: "hong-red",    name: "元江/红河",  basin: "tibet",     trunk: 2, area: 3, story: 2, neNames: ["Hong"], bboxFilter: [101, 21, 105, 25], note: "云南到越南河内，茶马古道云南段。" },

  // ===== 漕运（NE 不含运河，留 fallback）=====
  { id: "grand-canal", name: "京杭大运河", basin: "canal",     trunk: 1, area: 2, story: 5, neNames: ["Grand Canal"], note: "隋唐至清漕运动脉，南北经济命脉。" }
];

function score(r) { return (4 - r.trunk) + r.area + r.story; }

// 排序：分高优先，平分时干流优先
RIVER_RUBRIC.sort((a, b) => {
  const sb = score(b), sa = score(a);
  if (sb !== sa) return sb - sa;
  return a.trunk - b.trunk;
});

// ============================================================
// 下载 + 解析 Natural Earth GeoJSON
// ============================================================
async function ensureNaturalEarth() {
  await fs.mkdir(NE_CACHE_DIR, { recursive: true });
  try {
    await fs.access(NE_RIVERS_PATH);
    return; // cached
  } catch {}
  console.log(`下载 Natural Earth 10m rivers → ${NE_RIVERS_PATH}`);
  // Use curl since fetch in older Node may not support large stream nicely
  execSync(`curl -L --fail --silent --show-error -o "${NE_RIVERS_PATH}" "${NE_URL}"`, {
    stdio: "inherit"
  });
}

function pointInBBox([lon, lat], bbox) {
  // bbox = [west, south, east, north]
  return lon >= bbox[0] && lon <= bbox[2] && lat >= bbox[1] && lat <= bbox[3];
}

function segmentInBBox(coords, bbox) {
  return coords.some((p) => pointInBBox(p, bbox));
}

function pointsForRiver(geojson, river) {
  // 严格 name 相等（小写），避免 "Han" 子串误匹配 "Hangzhou"。
  const candidates = river.neNames.map((n) => n.toLowerCase());
  let matches = geojson.features.filter((f) => {
    const fields = [f.properties?.name, f.properties?.name_alt]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase());
    return fields.some((field) => candidates.includes(field));
  });
  if (matches.length === 0) return null;

  // 多段汇总。如果有 bboxFilter，只留落在框内的段。
  const all = [];
  matches.forEach((f) => {
    const geom = f.geometry;
    if (!geom) return;
    const segs = geom.type === "LineString"
      ? [geom.coordinates]
      : geom.type === "MultiLineString"
        ? geom.coordinates
        : [];
    segs.forEach((seg) => {
      if (river.bboxFilter && !segmentInBBox(seg, river.bboxFilter)) return;
      all.push(seg);
    });
  });
  return all.length > 0 ? all : null;
}

// ============================================================
// Main
// ============================================================
await ensureNaturalEarth();
const ne = JSON.parse(await fs.readFile(NE_RIVERS_PATH, "utf8"));
console.log(`Natural Earth rivers loaded: ${ne.features.length} features`);

const out = {
  schema: "qianli-jiangshan.china-major-rivers.v1",
  generatedAt: new Date().toISOString(),
  sourceData: "Natural Earth 10m rivers + lake centerlines (public domain)",
  selectionRubric:
    "score = (4 - trunk) + area + story. trunk: 1=干 / 2=一级支 / 3=二级支. area: 1-5 by drainage area. story: 0-5 historical significance.",
  rivers: []
};

let matched = 0;
let missing = [];
for (const r of RIVER_RUBRIC) {
  const polylines = pointsForRiver(ne, r);
  if (!polylines || polylines.length === 0) {
    missing.push(r.name);
    out.rivers.push({ ...r, score: score(r), polylines: [], matchedFromNE: false });
    continue;
  }
  matched += 1;
  out.rivers.push({
    ...r,
    score: score(r),
    polylines,
    matchedFromNE: true
  });
}

await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
await fs.writeFile(OUT_PATH, `${JSON.stringify(out, null, 2)}\n`, "utf8");
console.log(`\n输出 ${OUT_PATH}`);
console.log(`匹配 Natural Earth: ${matched}/${RIVER_RUBRIC.length}`);
if (missing.length > 0) {
  console.log(`未匹配（需手工 fallback）: ${missing.join(", ")}`);
}
console.log("\nTop 10 by score:");
out.rivers.slice(0, 10).forEach((r, i) => {
  console.log(`  ${i + 1}. ${r.name.padEnd(8)} score=${r.score} (trunk=${r.trunk} area=${r.area} story=${r.story}) ${r.matchedFromNE ? "✓" : "·"}`);
});
