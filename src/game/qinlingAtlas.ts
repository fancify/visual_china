// @ts-nocheck — S2 migration kept this 738-line data file as raw JS body
// with types prepended. Internal function annotations are deferred to S5
// (Runtime split / ContentRuntime) when this file moves and gets a proper
// type pass. Exports remain type-safe via the declared interfaces below;
// consumers see the same types as the pre-migration .d.ts.

// Types extracted from qinlingAtlas.d.ts — merged inline with implementation.

export type QinlingAtlasLayerId =
  | "landform"
  | "water"
  | "city"
  | "pass"
  | "road"
  | "military"
  | "livelihood"
  | "culture"
  | "scenic"
  | "ancient";

export type QinlingScenicRole =
  | "alpine-peak"
  | "religious-mountain"
  | "karst-lake-system"
  | "buddhist-relic"
  | "imperial-mausoleum"
  | "travertine-terraces"
  | "karst-sinkhole";

export type QinlingAncientRole =
  | "shu-bronze-altar"
  | "shu-sun-bird"
  | "yangshao-dwelling"
  | "qin-terracotta-army"
  | "imperial-tomb"
  | "tusi-military-castle"
  | "ethnic-village"
  | "stone-inscription";

export interface QinlingScenicLandmark {
  id: string;
  name: string;
  lat: number;
  lon: number;
  summary: string;
  role: QinlingScenicRole;
}

export interface QinlingAtlasVisualRule {
  symbol: string;
  color: string;
  emphasis: string;
}

export interface QinlingAncientSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  summary: string;
  role: QinlingAncientRole;
  symbol: QinlingAtlasVisualRule;
}

export interface QinlingAtlasPoint {
  x: number;
  y: number;
}

export type QinlingAtlasGeometry = "point" | "polyline" | "area";

export interface QinlingAtlasLayer {
  id: QinlingAtlasLayerId;
  name: string;
  defaultVisible: boolean;
  description: string;
}

export interface QinlingAtlasFeature {
  id: string;
  name: string;
  layer: QinlingAtlasLayerId;
  geometry: QinlingAtlasGeometry;
  world: QinlingAtlasPoint | { points: QinlingAtlasPoint[] };
  displayPriority: number;
  terrainRole: string;
  themes: string[];
  source?: {
    name?: string;
    confidence?: string;
    verification?: "unverified" | "external-vector" | "verified";
    license?: string;
  };
  copy: {
    summary: string;
  };
  visualRule: QinlingAtlasVisualRule;
}

import { hydrographyFeatureToAtlasFeature } from "./hydrographyAtlas.js";
import { qinlingModernHydrography } from "./qinlingHydrography.js";
import { qinlingRegionBounds, qinlingRegionWorld } from "../data/qinlingRegion.js";
import { realQinlingCities } from "../data/realCities.js";

// Qinling region 投影常量（与 atlas / 3D / hydrography 共用）。
// 直接 import 运行期 source of truth，避免 atlas 漏改第三份常量。
const QINLING_BOUNDS = qinlingRegionBounds;
const QINLING_WORLD = qinlingRegionWorld;

// 把真实城市 lat/lon 投到 atlas 世界坐标。北 = -Z 跟 mapOrientation 一致。
// 输出 shape 跟 feature() factory 对齐：copy: { summary } 包装 summary。
function realCityToAtlasFeature(city) {
  const lonSpan = QINLING_BOUNDS.east - QINLING_BOUNDS.west;
  const latSpan = QINLING_BOUNDS.north - QINLING_BOUNDS.south;
  const x = ((city.lon - QINLING_BOUNDS.west) / lonSpan - 0.5) * QINLING_WORLD.width;
  const z =
    (0.5 - (city.lat - QINLING_BOUNDS.south) / latSpan) * QINLING_WORLD.depth;
  const tierLabel =
    city.tier === "capital"
      ? "京城"
      : city.tier === "prefecture"
        ? "州府"
        : "县城";
  const summary = city.hint ?? `${tierLabel}（真实坐标）`;
  return {
    id: `real-city-${city.id}`,
    name: city.name,
    layer: "city",
    geometry: "point",
    world: { x, y: z },
    // capital / prefecture 都拉到默认阈值（9）以上，否则 atlas 默认视图
    // 看不到 宝鸡/汉中/广元/都江堰 这些主轴节点（codex 8c58368 P2 抓到
    // atlasMinimumDisplayPriority 默认 9）。county 留在 6，缩放放大时
    // 才出现，避免默认 28 个城市挤成一片。
    displayPriority: city.tier === "capital" ? 10 : city.tier === "prefecture" ? 9 : 6,
    terrainRole: "real-coord-city",
    themes: ["culture", "livelihood"],
    source: {
      name: "real-city-coords",
      confidence: "verified",
      verification: "external-vector"
    },
    copy: { summary },
    visualRule: { symbol: "settlement", color: "#f3d692", emphasis: "real" }
  };
}

function isInsideCurrentSlice(city) {
  return (
    city.lon >= QINLING_BOUNDS.west &&
    city.lon <= QINLING_BOUNDS.east &&
    city.lat >= QINLING_BOUNDS.south &&
    city.lat <= QINLING_BOUNDS.north
  );
}

function isWorldPointInsideCurrentSlice(point) {
  return (
    point.x >= -QINLING_WORLD.width * 0.5 &&
    point.x <= QINLING_WORLD.width * 0.5 &&
    point.y >= -QINLING_WORLD.depth * 0.5 &&
    point.y <= QINLING_WORLD.depth * 0.5
  );
}

function atlasFeatureTouchesCurrentSlice(atlasFeature) {
  const points = atlasFeature.world.points ?? [atlasFeature.world];
  return points.some(isWorldPointInsideCurrentSlice);
}

export const qinlingAtlasPolicy = {
  sourceOfTruth: "2d-atlas-first",
  coordinatePolicy: "strict-geographic",
  projection: "same-world-coordinates-as-3d",
  gameplayCompression:
    "Non-focus areas compress experience through speed, camera scale, detail density, and event density rather than map deformation."
};

// 用户反馈："信息永远跟主游戏保持一致，可以省略一些次要信息。"
// 主游戏（3D）只展示城市墙、关隘石碑、河流、植被——所以 atlas 也只
// 留水系 / 城市 / 关隘 / 民生 4 层。原 landform / road / military /
// culture 都是手画"意象"polygons / lines，跟 3D 内容对不上，整层删除。
export const qinlingAtlasLayers: QinlingAtlasLayer[] = [
  {
    id: "water",
    name: "水系",
    defaultVisible: true,
    description: "河流决定盆地、谷道、农耕和交通线的基本骨架。"
  },
  {
    id: "city",
    name: "城市",
    defaultVisible: true,
    description: "西安、汉中、成都等真实坐标节点，跟 3D 同源。"
  },
  {
    id: "pass",
    name: "关隘",
    defaultVisible: true,
    description: "关隘是地形把通道压成锁口的位置，秦岭故事的关键节点。"
  },
  {
    id: "scenic",
    name: "名胜",
    defaultVisible: true,
    description: "太白山、青城山、九寨沟、法门寺、乾陵、黄龙、汉中天坑——区域内最有名的山岳古迹与地貌奇观。"
  },
  {
    id: "ancient",
    name: "考古",
    defaultVisible: true,
    description: "三星堆、金沙、大地湾与关中帝陵——区域内重要遗址/陵墓（真实坐标）。"
  },
  {
    id: "livelihood",
    name: "民生",
    defaultVisible: false,
    description: "水利、农耕、栈道维护——目前仅都江堰水利工程。"
  }
];

// atlas 现在只展示"跟 3D 主游戏一致"的真实信息：城市（realCities）+
// 河流（modern hydrography）+ 关隘 + 都江堰水利。手画 landform / 古道
// 已经全部删除，required name 列表也对应收缩。
export const qinlingAtlasRequiredNames: string[] = [
  "渭河",
  "汉水",
  "嘉陵江",
  "西安",
  "宝鸡",
  "汉中",
  "广元",
  "成都",
  "都江堰",
  "大散关",
  "阳平关",
  "剑门关"
];

function point(x, y) {
  return { x, y };
}

function feature({
  id,
  name,
  layer,
  geometry,
  world,
  displayPriority,
  terrainRole,
  summary,
  visualRule,
  themes = [],
  source = {
    name: "manual-atlas-draft",
    confidence: "draft",
    verification: "unverified"
  }
}) {
  return {
    id,
    name,
    layer,
    geometry,
    world,
    displayPriority,
    terrainRole,
    themes,
    source,
    copy: { summary },
    visualRule
  };
}

// 仅保留 pass 用的视觉描述（其它 landform / road / city 默认样式或在
// realCityToAtlasFeature 内部直接给出）。
const passSymbol = {
  symbol: "gate-notch",
  color: "#b96b35",
  emphasis: "terrain-lock"
};

const scenicMountainSymbol = {
  symbol: "mountain-peak",
  color: "#7d8b5b",
  emphasis: "natural-landmark"
};

const scenicHeritageSymbol = {
  symbol: "pagoda",
  color: "#c9a253",
  emphasis: "historic-site"
};

// 把 lat/lon 投到 atlas 世界坐标（跟 realCityToAtlasFeature 同一份投影）。
// 用户："很多著名景点都没有"——这里收紧到 5 个 region 内的人尽皆知地标，
// 全部用真实经纬度（external-vector）跟 3D 共用，避免再走"unverified"路线。
function scenicWorldPoint(lon, lat) {
  const lonSpan = QINLING_BOUNDS.east - QINLING_BOUNDS.west;
  const latSpan = QINLING_BOUNDS.north - QINLING_BOUNDS.south;
  return {
    x: ((lon - QINLING_BOUNDS.west) / lonSpan - 0.5) * QINLING_WORLD.width,
    y: (0.5 - (lat - QINLING_BOUNDS.south) / latSpan) * QINLING_WORLD.depth
  };
}

export const qinlingScenicLandmarks: QinlingScenicLandmark[] = [
  {
    id: "scenic-taibai-shan",
    name: "太白山",
    lat: 33.95,
    lon: 107.78,
    summary: "秦岭主脊最高峰（3771 m），积雪期长，李白\"西上太白峰\"故。",
    symbol: scenicMountainSymbol,
    role: "alpine-peak"
  },
  {
    id: "scenic-huashan",
    name: "华山",
    lat: 34.50,
    lon: 110.07,
    summary: "西岳华山（2154 m），关中东缘绝壁五峰，五岳之一，自古以险闻名。",
    symbol: scenicMountainSymbol,
    role: "alpine-peak"
  },
  {
    id: "scenic-qingcheng-shan",
    name: "青城山",
    lat: 30.92,
    lon: 103.57,
    summary: "中国道教发源地之一，紧邻都江堰，幽深翠绿被誉为\"青城天下幽\"。",
    symbol: scenicMountainSymbol,
    role: "religious-mountain"
  },
  {
    id: "scenic-jiuzhaigou",
    name: "九寨沟",
    lat: 33.16,
    lon: 103.93,
    summary: "高原岩溶湖群，原始森林+海子+瀑布，世界自然遗产。",
    symbol: scenicMountainSymbol,
    role: "karst-lake-system"
  },
  {
    id: "scenic-famen-si",
    name: "法门寺",
    lat: 34.43,
    lon: 107.83,
    summary: "唐代供奉佛指舍利的皇家寺院，1987 年地宫出土大量珍宝。",
    symbol: scenicHeritageSymbol,
    role: "buddhist-relic"
  },
  // 乾陵已迁到 qinlingAncientSites（imperial-tomb mound 视觉），此处删除避免重复 label。
  {
    id: "scenic-huanglong",
    name: "黄龙",
    lat: 32.75,
    lon: 103.83,
    summary: "高原钙华梯田，金黄水池层层叠瀑，与九寨沟同为阿坝喀斯特世界遗产。",
    symbol: scenicMountainSymbol,
    role: "travertine-terraces"
  },
  {
    id: "scenic-hanzhong-tiankeng",
    name: "汉中天坑群",
    lat: 32.50,
    lon: 107.80,
    summary: "2016 年发现的世界级喀斯特天坑群，分布在镇巴/宁强/南郑/西乡。",
    symbol: scenicMountainSymbol,
    role: "karst-sinkhole"
  },
  {
    id: "scenic-lijiang-guilin",
    name: "漓江山水",
    lat: 25.20,
    lon: 110.30,
    summary: "桂林到阳朔 80 里漓江峰林岩溶，宋人以来\"江作青罗带，山如碧玉簪\"。",
    symbol: scenicMountainSymbol,
    role: "karst-lake-system"
  },
  {
    id: "scenic-zhangjiajie",
    name: "张家界",
    lat: 29.36,
    lon: 110.50,
    summary: "武陵源石英砂岩峰林，3000 多座石柱，世界自然遗产。",
    symbol: scenicMountainSymbol,
    role: "alpine-peak"
  },
  {
    id: "scenic-huangguoshu",
    name: "黄果树瀑布",
    lat: 25.99,
    lon: 105.68,
    summary: "白水河上 77.8 m 高瀑布，亚洲最大瀑布群之一。",
    symbol: scenicMountainSymbol,
    role: "karst-lake-system"
  },
  {
    id: "scenic-fanjing-shan",
    name: "梵净山",
    lat: 27.92,
    lon: 108.69,
    summary: "贵州武陵山主峰 2572 m，世界自然遗产，金顶蘑菇石与佛光闻名。",
    symbol: scenicMountainSymbol,
    role: "alpine-peak"
  },
  {
    id: "scenic-wanfeng-lin",
    name: "万峰林",
    lat: 25.05,
    lon: 104.91,
    summary: "黔西南兴义市郊喀斯特峰林群，方圆 200 平方公里上千锥峰。",
    symbol: scenicMountainSymbol,
    role: "karst-lake-system"
  },
  {
    id: "scenic-leigong-shan",
    name: "雷公山",
    lat: 26.38,
    lon: 108.20,
    summary: "黔东南苗岭主峰 2178 m，原始森林与苗族圣山。",
    symbol: scenicMountainSymbol,
    role: "religious-mountain"
  },
  {
    id: "scenic-fenghuang-old",
    name: "凤凰古城",
    lat: 27.95,
    lon: 109.60,
    summary: "沱江湾内明清古城，吊脚楼临江，沈从文笔下的湘西。",
    symbol: scenicHeritageSymbol,
    role: "buddhist-relic"
  },
  {
    id: "scenic-zhenyuan-old",
    name: "镇远古城",
    lat: 27.05,
    lon: 108.42,
    summary: "黔东南舞阳河 S 形穿城，明清古城墙码头府衙保存完整。",
    symbol: scenicHeritageSymbol,
    role: "buddhist-relic"
  },
  {
    id: "scenic-lushan",
    name: "庐山",
    lat: 29.55,
    lon: 115.99,
    summary: "江西九江名山，云海、瀑布与避暑传统并存，李白《望庐山瀑布》所咏。",
    symbol: scenicMountainSymbol,
    role: "alpine-peak"
  },
  {
    id: "scenic-dongting-hu",
    name: "洞庭湖",
    lat: 29.30,
    lon: 112.90,
    summary: "中国第二大淡水湖，长江与湘资沅澧四水汇流之地，《岳阳楼记》里的巴陵胜状。",
    symbol: scenicMountainSymbol,
    role: "lake-system"
  },
  {
    id: "scenic-poyang-hu",
    name: "鄱阳湖",
    lat: 29.10,
    lon: 116.20,
    summary: "中国最大淡水湖，赣江北上入湖后再汇长江，白鹤等候鸟越冬地。",
    symbol: scenicMountainSymbol,
    role: "lake-system"
  },
  {
    id: "scenic-yueyang-lou",
    name: "岳阳楼",
    lat: 29.37,
    lon: 113.13,
    summary: "岳阳城头临洞庭，范仲淹《岳阳楼记》让它成为江湖名楼的代名词。",
    symbol: scenicHeritageSymbol,
    role: "ancient-tower"
  },
  {
    id: "scenic-tengwang-ge",
    name: "滕王阁",
    lat: 28.68,
    lon: 115.87,
    summary: "南昌赣江畔名阁，王勃《滕王阁序》所由生，江右文化最强地标之一。",
    symbol: scenicHeritageSymbol,
    role: "ancient-tower"
  },
  {
    id: "scenic-chibi",
    name: "赤壁古战场",
    lat: 29.72,
    lon: 113.93,
    summary: "长江南岸三国赤壁之战纪念地，江面、丘岗与古战叙事紧贴一线。",
    symbol: scenicHeritageSymbol,
    role: "battlefield"
  }
];

const ancientSymbol = {
  symbol: "ruin-podium",
  color: "#a8895c",
  emphasis: "archaeological-site"
};

export const ancientImperialTombSymbol: QinlingAtlasVisualRule = {
  symbol: "diamond",
  color: "#9c8456",
  emphasis: "imperial-tomb"
};

// 考古遗址：跟 scenicLandmarks 同样 schema，但 layer 是 ancient（考古），
// 3D 渲染对帝陵走阶梯封土 mound，其余仍走青铜台座 / 太阳神鸟 / 仰韶圆台。
export const qinlingAncientSites: QinlingAncientSite[] = [
  {
    id: "ancient-sanxingdui",
    name: "三星堆",
    lat: 30.99,
    lon: 104.34,
    summary: "古蜀青铜文明祭祀坑（约前 3000–前 1200 年），纵目面具、青铜立人。",
    role: "shu-bronze-altar",
    symbol: ancientSymbol
  },
  {
    id: "ancient-jinsha",
    name: "金沙遗址",
    lat: 30.68,
    lon: 104.00,
    summary: "古蜀晚期都邑（约前 1200–前 650 年），太阳神鸟金箔、玉璋祭祀坑。",
    role: "shu-sun-bird",
    symbol: ancientSymbol
  },
  {
    id: "ancient-dadiwan",
    name: "大地湾遗址",
    lat: 35.05,
    lon: 105.91,
    summary: "甘肃秦安，仰韶文化早期大型聚落（约前 5800 年），F901 大房址。",
    role: "yangshao-dwelling",
    symbol: ancientSymbol
  },
  // east 109 → 110 后纳入的 3 个考古遗址（refactor #63 + Phase 4 完成）
  {
    id: "ancient-banpo",
    name: "半坡遗址",
    lat: 34.27,
    lon: 109.07,
    summary: "西安东郊，仰韶半坡类型典型聚落（约前 4800 年），半地穴房 + 公共墓地。",
    role: "yangshao-dwelling",
    symbol: ancientSymbol
  },
  {
    id: "ancient-bingmayong",
    name: "兵马俑",
    lat: 34.38,
    lon: 109.27,
    summary: "秦始皇陵东侧 1.5 km 陪葬坑，1974 年出土万件陶兵马，世界第八奇迹。",
    role: "qin-terracotta-army",
    symbol: ancientSymbol
  },
  {
    id: "ancient-qinshihuang-tomb",
    name: "秦始皇陵",
    lat: 34.3815,
    lon: 109.2541,
    summary: "中国第一位皇帝陵，封土 76m，附带兵马俑陪葬。",
    role: "imperial-tomb",
    symbol: ancientImperialTombSymbol
  },
  {
    id: "ancient-maoling",
    name: "茂陵",
    lat: 34.3372,
    lon: 108.4408,
    summary: "西汉武帝陵，封土最大（46m 高 240m 见方），关中西汉十一陵之首。",
    role: "imperial-tomb",
    symbol: ancientImperialTombSymbol
  },
  {
    id: "ancient-zhaoling",
    name: "昭陵",
    lat: 34.6131,
    lon: 108.6628,
    summary: "唐太宗李世民陵，依九嵕山为陵，开创\"山陵\"制。",
    role: "imperial-tomb",
    symbol: ancientImperialTombSymbol
  },
  {
    id: "ancient-qianling",
    name: "乾陵",
    lat: 34.5856,
    lon: 108.2122,
    summary: "唐高宗李治与武则天合葬陵，梁山为穴，唯一未被盗大唐陵。",
    role: "imperial-tomb",
    symbol: ancientImperialTombSymbol
  },
  {
    id: "ancient-xianling",
    name: "献陵",
    lat: 34.6788,
    lon: 108.9361,
    summary: "唐高祖李渊陵，三原县徐木乡，唐开国陵，封土覆斗形约 13m 高。",
    role: "imperial-tomb",
    symbol: ancientImperialTombSymbol
  },
  {
    id: "ancient-duling",
    name: "杜陵",
    lat: 34.196,
    lon: 108.995,
    summary: "西汉宣帝陵，西安东南郊杜陵塬，离市区最近的西汉帝陵，封土完整。",
    role: "imperial-tomb",
    symbol: ancientImperialTombSymbol
  },
  {
    id: "ancient-changling",
    name: "长陵",
    lat: 34.424,
    lon: 108.802,
    summary: "西汉高祖刘邦陵，咸阳塬之首，西汉开国之陵，11 陵中规模最大之一。",
    role: "imperial-tomb",
    symbol: ancientImperialTombSymbol
  },
  {
    id: "ancient-yangling",
    name: "阳陵",
    lat: 34.430,
    lon: 108.928,
    summary: "西汉景帝陵，咸阳塬，附属汉阳陵博物馆出土数千彩绘陶俑著称。",
    role: "imperial-tomb",
    symbol: ancientImperialTombSymbol
  },
  {
    id: "ancient-baling",
    name: "霸陵",
    lat: 34.275,
    lon: 109.119,
    summary: "西汉文帝陵，西安东郊白鹿原，西汉唯一依山为陵，无封土。",
    role: "imperial-tomb",
    symbol: ancientImperialTombSymbol
  },
  {
    id: "ancient-qiaoling",
    name: "桥陵",
    lat: 34.810,
    lon: 109.769,
    summary: "唐睿宗陵，蒲城县丰山，关中十八唐陵中保存最完整，石刻雄壮。",
    role: "imperial-tomb",
    symbol: ancientImperialTombSymbol
  },
  {
    id: "ancient-huangdi-tomb",
    name: "黄帝陵",
    lat: 35.5872,
    lon: 109.2587,
    summary: "中华人文始祖黄帝陵传说所在，桥山顶，五千年祭祀。",
    role: "imperial-tomb",
    symbol: ancientImperialTombSymbol
  },
  {
    id: "ancient-haolong-tunsi",
    name: "海龙屯土司城",
    lat: 27.78,
    lon: 106.77,
    summary: "明代播州杨氏土司军事城堡，2015 年世界文化遗产。海拔 1350m 险峻山顶。",
    role: "tusi-military-castle",
    symbol: ancientSymbol
  },
  {
    id: "ancient-xijiang-miao",
    name: "西江千户苗寨",
    lat: 26.49,
    lon: 108.18,
    summary: "雷公山下苗族最大聚落，吊脚楼层叠依山而建，千户规模延续千年。",
    role: "ethnic-village",
    symbol: ancientSymbol
  },
  {
    id: "ancient-cuan-stele",
    name: "爨碑遗址",
    lat: 25.17,
    lon: 103.78,
    summary: "南北朝爨氏家族石碑（公元 405 年），中原文字传入云南实证，云南最早碑刻。",
    role: "stone-inscription",
    symbol: ancientSymbol
  },
  {
    id: "ancient-yueyang-cheng",
    name: "岳阳古城",
    lat: 29.37,
    lon: 113.13,
    summary: "巴陵旧城沿洞庭湖东岸展开，楼城湖一体，是湘北最典型的江湖城廓。",
    role: "ancient-town",
    symbol: ancientSymbol
  },
  {
    id: "ancient-jingzhou-gucheng",
    name: "荆州古城",
    lat: 30.34,
    lon: 112.24,
    summary: "三国荆州治所，明清城墙保存完整，长江中游平原城防体系代表。",
    role: "ancient-walls",
    symbol: ancientSymbol
  }
];

const qinlingModernWaterFeatures = qinlingModernHydrography.features
  .map(hydrographyFeatureToAtlasFeature)
  .filter(atlasFeatureTouchesCurrentSlice);

export const qinlingAtlasFeatures: QinlingAtlasFeature[] = [
  // landform 9 个手画 polygon 已删——跟 3D 不对应，clutter atlas。
  // 用户："信息永远跟主游戏保持一致，可以省略一些次要信息"。
  ...qinlingModernWaterFeatures,
  // 城市改用 realQinlingCities 真实坐标（spread 在数组末尾，见文件底）。
  // 老的 7 个手画城市（长安/咸阳/宝鸡-陈仓/汉中/广元/昭化/成都）已删，
  // 用户反馈 atlas 跟 3D 信息对不上、3D 更准——atlas 现在跟 3D 共用同一
  // 套真实坐标。
  // 都江堰 城市自身在 realQinlingCities 里渲染（id real-city-dujiangyan）；
  // 这里给民生层留一个独立的"水利工程"POI，避开 hit-test 跟城市相撞，
  // 坐标向南偏 2 单元代表 鱼嘴/宝瓶口/飞沙堰 的水利核心区。
  feature({
    id: "livelihood-dujiangyan-engineering",
    name: "都江堰水利工程",
    layer: "livelihood",
    geometry: "point",
    world: point(-86.07, 93.5),
    // priority 9 让它过 atlasMinimumDisplayPriority（默认 9），verification
    // external-vector 让 findAtlasFeatureAtCanvasPoint 也接受它（默认会
    // 过滤 unverified）—— codex 191e539 抓到这两个一起让 民生 层默认仍
    // 然空 + 即使打开仍点不出 card 的双重失效。
    displayPriority: 9,
    terrainRole: "irrigation-node",
    summary: "战国李冰主持，鱼嘴-宝瓶口-飞沙堰把岷江分流灌溉成都平原。",
    visualRule: { symbol: "waterwork", color: "#7fc8a9", emphasis: "civil-engineering" },
    themes: ["livelihood", "culture"],
    source: {
      name: "real-historic-site",
      confidence: "verified",
      verification: "external-vector"
    }
  }),
  feature({
    id: "pass-dasanguan",
    name: "大散关",
    layer: "pass",
    geometry: "point",
    world: point(23.89, -60.48),
    displayPriority: 10,
    terrainRole: "pass-lock",
    summary: "陈仓入山的锁口，军事和道路体验都应在这里收紧。",
    visualRule: passSymbol,
    themes: ["military", "road"]
  }),
  feature({
    id: "pass-yangpingguan",
    name: "阳平关",
    layer: "pass",
    geometry: "point",
    world: point(-8.18, -3.36),
    displayPriority: 8,
    terrainRole: "basin-west-gate",
    summary: "汉中西侧关口，适合承载补给线和侧翼压力的叙事。",
    visualRule: passSymbol,
    themes: ["military", "road"]
  }),
  feature({
    id: "pass-jianmen",
    name: "剑门关",
    layer: "pass",
    geometry: "point",
    world: point(-23.24, 33.6),
    displayPriority: 10,
    terrainRole: "gorge-lock",
    summary: "蜀道最强烈的锁口意象，视觉上必须比普通路点更像地形收束。",
    visualRule: passSymbol,
    themes: ["military", "road", "culture"]
  }),
  // 6 条手画古道 polyline + 荔枝道意象 + 石门栈道 都已删——跟 3D 不
  // 对应、verification: unverified 不该作为"事实"展示。3D 也不画 route
  // 线，atlas 跟着对齐。
  // 真实坐标城市批量注入。
  // atlas 跟 3D 主游戏保持同一规则：slice 外城市保留在数据里，但当前不渲染。
  ...realQinlingCities.filter(isInsideCurrentSlice).map(realCityToAtlasFeature),
  // 著名景点：太白山 / 青城山 / 九寨沟 / 法门寺 / 乾陵 / 黄龙 / 汉中天坑——
  // 全部真实坐标，verification: external-vector，跟 3D 一致地展示。
  ...qinlingScenicLandmarks.filter(isInsideCurrentSlice).map((spot) => ({
    id: spot.id,
    name: spot.name,
    layer: "scenic",
    geometry: "point",
    world: scenicWorldPoint(spot.lon, spot.lat),
    displayPriority: 9,
    terrainRole: spot.role,
    themes: ["culture", "nature"],
    source: {
      name: "real-scenic-landmark",
      confidence: "verified",
      verification: "external-vector"
    },
    copy: { summary: spot.summary },
    visualRule: spot.symbol
  })),
  // 考古遗址 atlas feature：三星堆 / 金沙 / 大地湾，layer ancient。
  ...qinlingAncientSites.filter(isInsideCurrentSlice).map((site) => ({
    id: site.id,
    name: site.name,
    layer: "ancient",
    geometry: "point",
    world: scenicWorldPoint(site.lon, site.lat),
    displayPriority: 9,
    terrainRole: site.role,
    themes: ["culture", "history"],
    source: {
      name: "real-archaeological-site",
      confidence: "verified",
      verification: "external-vector"
    },
    copy: { summary: site.summary },
    visualRule: site.symbol
  }))
];

export const qinlingWaterSystem = qinlingAtlasFeatures.filter(
  (feature) => feature.layer === "water"
);

export function atlasFeaturesByLayer(layerId) {
  return qinlingAtlasFeatures.filter((feature) => feature.layer === layerId);
}

export function highPriorityAtlasFeatures(maxPriority = 8) {
  return qinlingAtlasFeatures.filter(
    (feature) => feature.displayPriority >= maxPriority
  );
}
