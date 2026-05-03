import { qinlingNeRivers } from "./data/qinlingNeRivers.js";

const baseQinlingModernHydrography = {
  schema: "visual-china.region-hydrography.v1",
  regionId: "qinling",
  eraId: "modern",
  basePolicy: "modern-hydrography",
  notes: [
    "First curated modern hydrography skeleton for Qinling Atlas.",
    "主要河流 (渭河/汉水/嘉陵江) 的坐标由 Natural Earth 10m 真实矢量替换 — 跑 scripts/build-qinling-hydrography-from-ne.mjs 重新生成 src/game/data/qinlingNeRivers.js。",
    "岷江、所有小支流 (褒水/斜水/外江/内江) 仍为 hand-typed (NE 10m 在切片范围内没收到这些)。"
  ],
  features: [
    {
      id: "river-weihe",
      name: "渭河",
      aliases: [],
      kind: "river",
      rank: 1,
      basin: "黄河流域",
      eraId: "modern",
      source: { name: "curated-modern-qinling", confidence: "medium" },
      relations: ["city-changan", "city-xianyang", "city-baoji-chencang"],
      geometry: {
        points: [
          { lat: 34.4, lon: 106.98333 },
          { lat: 34.35833, lon: 107.71667 },
          { lat: 34.3375, lon: 108.38889 },
          { lat: 34.31667, lon: 109 }
        ]
      }
    },
    {
      id: "river-hanjiang",
      name: "汉江/汉水",
      displayName: "汉水",
      aliases: ["汉水"],
      kind: "river",
      rank: 1,
      basin: "长江流域",
      eraId: "modern",
      source: { name: "curated-modern-qinling", confidence: "medium" },
      relations: ["city-hanzhong", "road-jinniu-jianmen"],
      geometry: {
        points: [
          { lat: 32.9625, lon: 106.00556 },
          { lat: 33.06667, lon: 106.67778 },
          { lat: 33.0875, lon: 107.04444 },
          { lat: 33.04583, lon: 107.53333 },
          { lat: 32.9, lon: 108.14444 }
        ]
      }
    },
    {
      id: "river-jialingjiang",
      name: "嘉陵江",
      aliases: [],
      kind: "river",
      rank: 1,
      basin: "长江流域",
      eraId: "modern",
      source: { name: "curated-modern-qinling", confidence: "medium" },
      relations: ["city-guangyuan", "city-zhaohua", "pass-jianmen"],
      geometry: {
        points: [
          { lat: 32.9625, lon: 106.00556 },
          { lat: 32.48333, lon: 105.88333 },
          { lat: 32.31667, lon: 105.94444 },
          { lat: 31.56667, lon: 106.00556 }
        ]
      }
    },
    {
      id: "stream-baohe",
      name: "褒河",
      displayName: "褒水",
      aliases: ["褒水"],
      kind: "stream",
      rank: 3,
      basin: "汉江流域",
      eraId: "modern",
      source: { name: "curated-modern-qinling", confidence: "medium" },
      relations: ["road-baoxie", "military-shimen"],
      geometry: {
        points: [
          { lat: 33.12917, lon: 106.98333 },
          { lat: 33.275, lon: 107.16667 },
          { lat: 33.48333, lon: 107.28889 },
          { lat: 33.7125, lon: 107.41111 }
        ]
      }
    },
    {
      id: "stream-xieshui",
      name: "斜水",
      aliases: [],
      kind: "stream",
      rank: 3,
      basin: "黄河流域",
      eraId: "modern",
      source: { name: "curated-modern-qinling", confidence: "medium" },
      relations: ["road-baoxie"],
      geometry: {
        points: [
          { lat: 34.35833, lon: 108.02222 },
          { lat: 34.10833, lon: 107.80833 },
          { lat: 33.9, lon: 107.59444 },
          { lat: 33.7125, lon: 107.41111 }
        ]
      }
    },
    {
      id: "river-minjiang-upper",
      name: "岷江",
      aliases: [],
      kind: "river",
      rank: 1,
      basin: "长江流域",
      eraId: "modern",
      source: { name: "curated-modern-qinling", confidence: "medium" },
      relations: ["livelihood-dujiangyan-engineering", "city-dujiangyan"],
      // 上游：松潘（北界附近）→ 茂县 → 汶川 → 都江堰（鱼嘴分流点）。
      // 河谷大致沿龙门山西缘南下，最后在都江堰出山进入成都平原。
      // 终点 (-86, 92) 即都江堰真实坐标 (lat 30.987, lon 103.62) 的投影。
      geometry: {
        points: [
          { lat: 32.94167, lon: 103.62222 },
          { lat: 32.525, lon: 103.56111 },
          { lat: 32.10833, lon: 103.53056 },
          { lat: 31.69167, lon: 103.56111 },
          { lat: 31.31667, lon: 103.59167 },
          { lat: 30.98333, lon: 103.62222 }
        ]
      }
    },
    {
      id: "river-minjiang-outer",
      name: "外江",
      displayName: "外江",
      aliases: ["金马河", "岷江外江"],
      kind: "river",
      rank: 1,
      basin: "长江流域",
      eraId: "modern",
      source: { name: "curated-modern-qinling", confidence: "medium" },
      relations: ["livelihood-dujiangyan-engineering"],
      // 都江堰 鱼嘴 的"主流分支"：经 崇州、新津、彭山 续向南，
      // 最终（slice 外）在 宜宾 汇入 长江。这里只画到 slice 南界附近。
      // 起点跟 岷江上游终点 (-86, 92) 共享，保持视觉连贯。
      geometry: {
        points: [
          { lat: 30.98333, lon: 103.62222 },
          { lat: 30.81667, lon: 103.62222 },
          { lat: 30.60833, lon: 103.68333 },
          { lat: 30.42083, lon: 103.775 }
        ]
      }
    },
    {
      id: "river-minjiang-inner",
      name: "内江",
      displayName: "内江",
      aliases: ["走马河", "蒲阳河", "岷江内江"],
      kind: "river",
      rank: 2,
      basin: "长江流域",
      eraId: "modern",
      source: { name: "curated-modern-qinling", confidence: "medium" },
      relations: ["livelihood-dujiangyan-engineering", "real-city-chengdu"],
      // 鱼嘴 → 宝瓶口 → 灌溉成都平原 → 在 成都 汇入 锦江体系。
      // 起点 (-86, 92) = 鱼嘴；过 宝瓶口 后向东南偏，经 郫都 到达 成都
      // 真实坐标 (-71.5, 107.5)。对应 都江堰内江-走马河-府河 的水道走向。
      geometry: {
        points: [
          { lat: 30.98333, lon: 103.62222 },
          { lat: 30.92083, lon: 103.68333 },
          { lat: 30.8375, lon: 103.80556 },
          { lat: 30.75417, lon: 103.92778 },
          { lat: 30.66042, lon: 104.06528 }
        ]
      }
    }
  ]
};

// 用 NE 真实矢量替换 hand-typed 控制点（仅替换 geometry.points，
// 保留 displayName / aliases / relations / source 等手工 metadata）。
const qinlingModernHydrographyFeatures = baseQinlingModernHydrography.features.map((feature) => {
  const ne = qinlingNeRivers[feature.id];
  if (!ne || !ne.points || ne.points.length === 0) return feature;
  return {
    ...feature,
    geometry: { ...feature.geometry, points: ne.points },
    source: { name: "natural-earth-10m", confidence: "high", verification: "external-vector" }
  };
});

export const qinlingModernHydrography = {
  ...baseQinlingModernHydrography,
  features: qinlingModernHydrographyFeatures
};
