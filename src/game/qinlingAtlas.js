import { hydrographyFeatureToAtlasFeature } from "./hydrographyAtlas.js";
import { qinlingModernHydrography } from "./qinlingHydrography.js";
import { realQinlingCities } from "../data/realCities.js";

// Qinling region 投影常量（与 atlas / 3D / hydrography 共用）。
// 跟 src/data/qinlingRegion.js + scripts/qinling-dem-common.mjs 同值。
// 2026-05 east 109 → 110（refactor #63 之后，bounds 改是一行）。
const QINLING_BOUNDS = { west: 103.5, east: 110, south: 30.4, north: 35.4 };
const QINLING_WORLD = { width: 180, depth: 240 };

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
export const qinlingAtlasLayers = [
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
    description: "三星堆、金沙、大地湾——区域内已发掘的史前/古蜀文明遗址（真实坐标）。"
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
export const qinlingAtlasRequiredNames = [
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

export const qinlingScenicLandmarks = [
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
  {
    id: "scenic-qian-ling",
    name: "乾陵",
    lat: 34.59,
    lon: 108.20,
    summary: "唐高宗与武则天合葬陵，唐代石刻无字碑、石狮以雄浑著称。",
    symbol: scenicHeritageSymbol,
    role: "imperial-mausoleum"
  },
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
  }
];

// 考古遗址：跟 scenicLandmarks 同样 schema，但 layer 是 ancient（考古），
// 3D 渲染走另一组 mesh（青铜台座 / 太阳神鸟 / 仰韶圆台）。
export const qinlingAncientSites = [
  {
    id: "ancient-sanxingdui",
    name: "三星堆",
    lat: 30.99,
    lon: 104.34,
    summary: "古蜀青铜文明祭祀坑（约前 3000–前 1200 年），纵目面具、青铜立人。",
    role: "shu-bronze-altar"
  },
  {
    id: "ancient-jinsha",
    name: "金沙遗址",
    lat: 30.68,
    lon: 104.00,
    summary: "古蜀晚期都邑（约前 1200–前 650 年），太阳神鸟金箔、玉璋祭祀坑。",
    role: "shu-sun-bird"
  },
  {
    id: "ancient-dadiwan",
    name: "大地湾遗址",
    lat: 35.05,
    lon: 105.91,
    summary: "甘肃秦安，仰韶文化早期大型聚落（约前 5800 年），F901 大房址。",
    role: "yangshao-dwelling"
  },
  // east 109 → 110 后纳入的 3 个考古遗址（refactor #63 + Phase 4 完成）
  {
    id: "ancient-banpo",
    name: "半坡遗址",
    lat: 34.27,
    lon: 109.07,
    summary: "西安东郊，仰韶半坡类型典型聚落（约前 4800 年），半地穴房 + 公共墓地。",
    role: "yangshao-dwelling"
  },
  {
    id: "ancient-bingmayong",
    name: "兵马俑",
    lat: 34.38,
    lon: 109.27,
    summary: "秦始皇陵东侧 1.5 km 陪葬坑，1974 年出土万件陶兵马，世界第八奇迹。",
    role: "qin-terracotta-army"
  },
  {
    id: "ancient-qinshihuang-mausoleum",
    name: "秦始皇陵",
    lat: 34.38,
    lon: 109.25,
    summary: "中国第一个统一帝王陵（前 246–前 208 建造），封土高 76 m，地宫至今未发掘。",
    role: "qin-imperial-mausoleum"
  }
];

const ancientSymbol = {
  symbol: "ruin-podium",
  color: "#a8895c",
  emphasis: "archaeological-site"
};

const qinlingModernWaterFeatures = qinlingModernHydrography.features.map(
  hydrographyFeatureToAtlasFeature
);

export const qinlingAtlasFeatures = [
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
  ...realQinlingCities.map(realCityToAtlasFeature),
  // 著名景点：太白山 / 青城山 / 九寨沟 / 法门寺 / 乾陵 / 黄龙 / 汉中天坑——
  // 全部真实坐标，verification: external-vector，跟 3D 一致地展示。
  ...qinlingScenicLandmarks.map((spot) => ({
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
  ...qinlingAncientSites.map((site) => ({
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
    visualRule: ancientSymbol
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
