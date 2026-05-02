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
    }
  ]
};
