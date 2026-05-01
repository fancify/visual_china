import { hydrographyFeatureToAtlasFeature } from "./hydrographyAtlas.js";
import { qinlingModernHydrography } from "./qinlingHydrography.js";

export const qinlingAtlasPolicy = {
  sourceOfTruth: "2d-atlas-first",
  coordinatePolicy: "strict-geographic",
  projection: "same-world-coordinates-as-3d",
  gameplayCompression:
    "Non-focus areas compress experience through speed, camera scale, detail density, and event density rather than map deformation."
};

export const qinlingAtlasLayers = [
  {
    id: "landform",
    name: "地貌",
    defaultVisible: true,
    description: "先读平原、主脊、盆地、峡谷，不急着看所有 POI。"
  },
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
    description: "只保留组织空间的核心城市和枢纽。"
  },
  {
    id: "pass",
    name: "关隘",
    defaultVisible: true,
    description: "山地把宽阔行动面压缩成少数锁口。"
  },
  {
    id: "road",
    name: "古道",
    defaultVisible: true,
    description: "道路是玩家行动、叙事和补给压力的主线。"
  },
  {
    id: "military",
    name: "军事",
    defaultVisible: false,
    description: "展示腹地、锁眼、补给、侧翼和纵深。"
  },
  {
    id: "livelihood",
    name: "民生",
    defaultVisible: false,
    description: "展示水利、农耕、聚落、栈道维护和物资流动。"
  },
  {
    id: "culture",
    name: "人文",
    defaultVisible: false,
    description: "展示诗文、传说、驿传和地方记忆。"
  }
];

export const qinlingAtlasRequiredNames = [
  "关中平原",
  "渭河平原",
  "秦岭主脊",
  "太白山",
  "汉中盆地",
  "米仓山",
  "大巴山",
  "剑门地形",
  "成都平原",
  "渭河",
  "汉水",
  "嘉陵江",
  "褒水",
  "斜水",
  "长安",
  "咸阳",
  "宝鸡/陈仓",
  "汉中",
  "广元",
  "昭化",
  "剑门关",
  "成都",
  "都江堰",
  "大散关",
  "阳平关",
  "陈仓道",
  "褒斜道",
  "傥骆道",
  "子午道",
  "金牛道/剑门蜀道",
  "米仓道",
  "荔枝道意象"
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
  themes = []
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
    copy: { summary },
    visualRule
  };
}

const landformSymbol = {
  symbol: "area-label",
  color: "#8f8b5a",
  emphasis: "broad-shape"
};

const citySymbol = {
  symbol: "settlement-dot",
  color: "#e9c46a",
  emphasis: "node"
};

const passSymbol = {
  symbol: "gate-notch",
  color: "#b96b35",
  emphasis: "terrain-lock"
};

const roadSymbol = {
  symbol: "dashed-corridor",
  color: "#d49a4a",
  emphasis: "walkable-route"
};

const qinlingModernWaterFeatures = qinlingModernHydrography.features.map(
  hydrographyFeatureToAtlasFeature
);

export const qinlingAtlasFeatures = [
  feature({
    id: "landform-guanzhong-plain",
    name: "关中平原",
    layer: "landform",
    geometry: "area",
    world: { points: [point(12, 58), point(88, 58), point(88, 86), point(12, 86)] },
    displayPriority: 10,
    terrainRole: "lowland-plain",
    summary: "秦岭北侧的开阔组织面，长安、咸阳、宝鸡都依附这条平原带。",
    visualRule: landformSymbol,
    themes: ["terrain", "livelihood", "military"]
  }),
  feature({
    id: "landform-weihe-plain",
    name: "渭河平原",
    layer: "landform",
    geometry: "area",
    world: { points: [point(20, 62), point(85, 62), point(85, 78), point(20, 78)] },
    displayPriority: 9,
    terrainRole: "river-plain",
    summary: "渭河把关中平原串成连续农耕与交通走廊。",
    visualRule: landformSymbol,
    themes: ["terrain", "livelihood"]
  }),
  feature({
    id: "landform-qinling-ridge",
    name: "秦岭主脊",
    layer: "landform",
    geometry: "polyline",
    world: { points: [point(8, 46), point(32, 50), point(50, 48), point(70, 42), point(88, 34)] },
    displayPriority: 10,
    terrainRole: "ridge-wall",
    summary: "横向山墙把北方平原和南方盆地切开，是所有道路必须解释的主结构。",
    visualRule: { ...landformSymbol, symbol: "ridge-line", color: "#9b8755" },
    themes: ["terrain", "military"]
  }),
  feature({
    id: "landform-taibai",
    name: "太白山",
    layer: "landform",
    geometry: "point",
    world: point(49.75, 52.8),
    displayPriority: 9,
    terrainRole: "high-ridge",
    summary: "秦岭最高意象之一，视觉上应强调主脊压迫，但不能把周边全做成针峰。",
    visualRule: { ...landformSymbol, symbol: "peak" },
    themes: ["terrain"]
  }),
  feature({
    id: "landform-hanzhong-basin",
    name: "汉中盆地",
    layer: "landform",
    geometry: "area",
    world: { points: [point(2, -2), point(52, -2), point(52, 20), point(2, 20)] },
    displayPriority: 10,
    terrainRole: "basin-lowland",
    summary: "翻过秦岭后的第一处舒展地带，是南北转换的门轴。",
    visualRule: { ...landformSymbol, color: "#78966b" },
    themes: ["terrain", "livelihood", "military"]
  }),
  feature({
    id: "landform-micangshan",
    name: "米仓山",
    layer: "landform",
    geometry: "polyline",
    world: { points: [point(-4, -18), point(15, -20), point(36, -23), point(56, -30)] },
    displayPriority: 8,
    terrainRole: "second-ridge",
    summary: "汉中南侧的第二道山地压力，提示入蜀并不是一马平川。",
    visualRule: { ...landformSymbol, symbol: "ridge-line" },
    themes: ["terrain", "military"]
  }),
  feature({
    id: "landform-dabashan",
    name: "大巴山",
    layer: "landform",
    geometry: "polyline",
    world: { points: [point(6, -34), point(30, -31), point(58, -34), point(82, -42)] },
    displayPriority: 8,
    terrainRole: "second-ridge",
    summary: "米仓山和大巴山共同构成汉中到巴蜀之间的再压缩。",
    visualRule: { ...landformSymbol, symbol: "ridge-line" },
    themes: ["terrain", "military"]
  }),
  feature({
    id: "landform-jianmen",
    name: "剑门地形",
    layer: "landform",
    geometry: "area",
    world: { points: [point(-32, -20), point(-12, -24), point(-14, -42), point(-34, -38)] },
    displayPriority: 10,
    terrainRole: "gorge-lock",
    summary: "广元到剑阁之间的峡门地形，把入蜀路线收成极窄的关口。",
    visualRule: { ...passSymbol, symbol: "gorge-area" },
    themes: ["terrain", "military"]
  }),
  feature({
    id: "landform-chengdu-plain",
    name: "成都平原",
    layer: "landform",
    geometry: "area",
    world: { points: [point(-88, -114), point(-42, -114), point(-42, -84), point(-88, -84)] },
    displayPriority: 9,
    terrainRole: "lowland-plain",
    summary: "穿过剑门后突然舒展的盆地平原，是入蜀叙事的空间回报。",
    visualRule: { ...landformSymbol, color: "#769d68" },
    themes: ["terrain", "livelihood"]
  }),
  ...qinlingModernWaterFeatures,
  feature({
    id: "city-changan",
    name: "长安",
    layer: "city",
    geometry: "point",
    world: point(88.04, 69.12),
    displayPriority: 10,
    terrainRole: "capital-node",
    summary: "关中叙事起点，政治组织力从这里向山地边缘延伸。",
    visualRule: citySymbol,
    themes: ["culture", "military", "livelihood"]
  }),
  feature({
    id: "city-xianyang",
    name: "咸阳",
    layer: "city",
    geometry: "point",
    world: point(80.51, 68.64),
    displayPriority: 7,
    terrainRole: "plain-city",
    summary: "关中城市带的一环，帮助读出平原不是孤点而是连续面。",
    visualRule: citySymbol,
    themes: ["culture", "livelihood"]
  }),
  feature({
    id: "city-baoji-chencang",
    name: "宝鸡/陈仓",
    layer: "city",
    geometry: "point",
    world: point(29.45, 70.08),
    displayPriority: 9,
    terrainRole: "western-gate-city",
    summary: "关中西端的山前节点，陈仓道由此获得战略意义。",
    visualRule: citySymbol,
    themes: ["military", "road"]
  }),
  feature({
    id: "city-hanzhong",
    name: "汉中",
    layer: "city",
    geometry: "point",
    world: point(25.53, 8.16),
    displayPriority: 10,
    terrainRole: "basin-hinge",
    summary: "秦岭南侧的盆地枢纽，连接关中、巴蜀与汉水走廊。",
    visualRule: citySymbol,
    themes: ["military", "livelihood"]
  }),
  feature({
    id: "city-guangyuan",
    name: "广元",
    layer: "city",
    geometry: "point",
    world: point(-13.42, -22.08),
    displayPriority: 9,
    terrainRole: "shu-gate-city",
    summary: "汉中南下入蜀前的关键节点，邻近嘉陵江与剑门关。",
    visualRule: citySymbol,
    themes: ["military", "road"]
  }),
  feature({
    id: "city-zhaohua",
    name: "昭化",
    layer: "city",
    geometry: "point",
    world: point(-9.49, -27.84),
    displayPriority: 7,
    terrainRole: "river-town",
    summary: "嘉陵江节点，适合表达水陆转运和山地聚落。",
    visualRule: citySymbol,
    themes: ["livelihood", "road"]
  }),
  feature({
    id: "city-chengdu",
    name: "成都",
    layer: "city",
    geometry: "point",
    world: point(-71.35, -107.04),
    displayPriority: 9,
    terrainRole: "plain-center",
    summary: "入蜀后的空间中心，和长安形成南北两端的组织对照。",
    visualRule: citySymbol,
    themes: ["culture", "livelihood"]
  }),
  feature({
    id: "livelihood-dujiangyan",
    name: "都江堰",
    layer: "livelihood",
    geometry: "point",
    world: point(-86.07, -91.2),
    displayPriority: 8,
    terrainRole: "irrigation-node",
    summary: "成都平原的水利意象，用于解释平原为什么能承载高密度生活。",
    visualRule: { symbol: "waterwork", color: "#7fc8a9", emphasis: "civil-engineering" },
    themes: ["livelihood", "culture"]
  }),
  feature({
    id: "pass-dasanguan",
    name: "大散关",
    layer: "pass",
    geometry: "point",
    world: point(23.89, 60.48),
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
    world: point(-8.18, 3.36),
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
    world: point(-23.24, -33.6),
    displayPriority: 10,
    terrainRole: "gorge-lock",
    summary: "蜀道最强烈的锁口意象，视觉上必须比普通路点更像地形收束。",
    visualRule: passSymbol,
    themes: ["military", "road", "culture"]
  }),
  feature({
    id: "road-chencang",
    name: "陈仓道",
    layer: "road",
    geometry: "polyline",
    world: { points: [point(29.45, 70.08), point(23.89, 60.48), point(16.36, 43.2), point(-3.27, 20.64), point(14.07, 12.48), point(25.53, 8.16)] },
    displayPriority: 10,
    terrainRole: "western-crossing",
    summary: "从关中西端绕入汉中的路线，适合表现战略迂回。",
    visualRule: roadSymbol,
    themes: ["road", "military"]
  }),
  feature({
    id: "road-baoxie",
    name: "褒斜道",
    layer: "road",
    geometry: "polyline",
    world: { points: [point(58, 70), point(48, 56), point(40, 42), point(34, 28), point(30, 17), point(26, 8)] },
    displayPriority: 10,
    terrainRole: "valley-crossing",
    summary: "沿褒斜谷穿越秦岭，最适合直观表现河谷如何给道路开缝。",
    visualRule: roadSymbol,
    themes: ["road", "livelihood", "military"]
  }),
  feature({
    id: "road-tangluo",
    name: "傥骆道",
    layer: "road",
    geometry: "polyline",
    world: { points: [point(76, 68), point(66, 52), point(56, 36), point(46, 22), point(36, 12), point(26, 8)] },
    displayPriority: 8,
    terrainRole: "steep-crossing",
    summary: "更陡、更碎、更冒险的山地路线，用于表现速度和补给惩罚。",
    visualRule: roadSymbol,
    themes: ["road", "military"]
  }),
  feature({
    id: "road-ziwu",
    name: "子午道",
    layer: "road",
    geometry: "polyline",
    world: { points: [point(88, 69), point(78, 53), point(66, 38), point(54, 24), point(40, 13), point(26, 8)] },
    displayPriority: 8,
    terrainRole: "direct-risk-crossing",
    summary: "直线诱人但山地风险高，可用于行动上表现走捷径的代价。",
    visualRule: roadSymbol,
    themes: ["road", "military"]
  }),
  feature({
    id: "road-jinniu-jianmen",
    name: "金牛道/剑门蜀道",
    layer: "road",
    geometry: "polyline",
    world: { points: [point(25.53, 8.16), point(-13.42, -22.08), point(-23.24, -33.6), point(-8.18, -64.32), point(-71.35, -107.04)] },
    displayPriority: 10,
    terrainRole: "shu-crossing",
    summary: "从汉中南下入蜀的第二次收束，串起广元、剑门关和成都平原。",
    visualRule: roadSymbol,
    themes: ["road", "military", "culture"]
  }),
  feature({
    id: "road-micang",
    name: "米仓道",
    layer: "road",
    geometry: "polyline",
    world: { points: [point(25.53, 8.16), point(34, -8), point(16.36, -49.92), point(-8.18, -64.32)] },
    displayPriority: 7,
    terrainRole: "southern-mountain-road",
    summary: "汉中南侧另一组山地通道，用于扩展非唯一路线感。",
    visualRule: roadSymbol,
    themes: ["road", "livelihood"]
  }),
  feature({
    id: "culture-lychee-road",
    name: "荔枝道意象",
    layer: "culture",
    geometry: "polyline",
    world: { points: [point(88.04, 69.12), point(54, 24), point(25.53, 8.16), point(16.36, -49.92)] },
    displayPriority: 5,
    terrainRole: "cultural-memory-route",
    summary: "先作为文化路线意象保留，后续再和更精确史料版本对齐。",
    visualRule: { ...roadSymbol, symbol: "memory-thread", color: "#e6b56f" },
    themes: ["culture", "road"]
  }),
  feature({
    id: "military-shimen",
    name: "石门栈道",
    layer: "military",
    geometry: "point",
    world: point(22.25, 12),
    displayPriority: 7,
    terrainRole: "gallery-road",
    summary: "栈道维护、峡谷通行和军需运输可以在这里被具象化。",
    visualRule: { symbol: "plank-road", color: "#c88955", emphasis: "infrastructure" },
    themes: ["military", "livelihood", "road"]
  })
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
