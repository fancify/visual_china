export const qinlingModernHydrography = {
  schema: "visual-china.region-hydrography.v1",
  regionId: "qinling",
  eraId: "modern",
  basePolicy: "modern-hydrography",
  notes: [
    "First curated modern hydrography skeleton for Qinling Atlas.",
    "Coordinates use current project world coordinates and must be replaced or corrected by imported vector sources in later pipeline steps."
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
          { x: 24, y: -72 },
          { x: 48, y: -70 },
          { x: 70, y: -69 },
          { x: 90, y: -68 }
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
          { x: -8, y: -3 },
          { x: 14, y: -8 },
          { x: 26, y: -9 },
          { x: 42, y: -7 },
          { x: 62, y: 0 }
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
          { x: -8, y: -3 },
          { x: -12, y: 20 },
          { x: -10, y: 28 },
          { x: -8, y: 64 }
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
          { x: 24, y: -11 },
          { x: 30, y: -18 },
          { x: 34, y: -28 },
          { x: 38, y: -39 }
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
          { x: 58, y: -70 },
          { x: 51, y: -58 },
          { x: 44, y: -48 },
          { x: 38, y: -39 }
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
          { x: -86, y: -2 },
          { x: -88, y: 18 },
          { x: -89, y: 38 },
          { x: -88, y: 58 },
          { x: -87, y: 76 },
          { x: -86, y: 92 }
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
          { x: -86, y: 92 },
          { x: -86, y: 100 },
          { x: -84, y: 110 },
          { x: -81, y: 119 }
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
          { x: -86, y: 92 },
          { x: -84, y: 95 },
          { x: -80, y: 99 },
          { x: -76, y: 103 },
          { x: -71.5, y: 107.5 }
        ]
      }
    }
  ]
};
