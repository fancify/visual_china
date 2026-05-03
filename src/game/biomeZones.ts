import { MathUtils } from "three";

import type { GeoPoint as GeographicCoordinate } from "./mapOrientation.js";

export type { GeographicCoordinate };

export type BiomeId =
  | "subtropical-humid"
  | "warm-temperate-humid"
  | "warm-temperate-semiarid";

export interface BiomeWeights {
  biomeId: BiomeId;
  /** 基础色调偏移：负=往黄、正=往蓝绿 */
  hueShift: number;
  /** 饱和度乘子 */
  satScale: number;
  /** 亮度乘子 */
  lumScale: number;
  /** 树密度乘子（0..2） */
  vegetationDensity: number;
  /** 树颜色 hue（替换 sharedTreeMaterial 默认绿） */
  treeHue: number;
}

const BIOME_PRESETS: Record<BiomeId, Omit<BiomeWeights, "biomeId">> = {
  "subtropical-humid": {
    hueShift: 0.028,
    satScale: 1.16,
    lumScale: 0.96,
    vegetationDensity: 1.3,
    treeHue: 0.31
  },
  "warm-temperate-humid": {
    hueShift: -0.012,
    satScale: 0.92,
    lumScale: 1.02,
    vegetationDensity: 0.85,
    treeHue: 0.24
  },
  "warm-temperate-semiarid": {
    hueShift: -0.045,
    satScale: 0.76,
    lumScale: 1.08,
    vegetationDensity: 0.45,
    treeHue: 0.18
  }
};

function smoothBlend(value: number, start: number, end: number): number {
  if (value <= start) {
    return 0;
  }

  if (value >= end) {
    return 1;
  }

  return MathUtils.smoothstep(value, start, end);
}

function blendProperty(
  southWeight: number,
  humidWeight: number,
  semiaridWeight: number,
  property: keyof Omit<BiomeWeights, "biomeId">
): number {
  return (
    BIOME_PRESETS["subtropical-humid"][property] * southWeight +
    BIOME_PRESETS["warm-temperate-humid"][property] * humidWeight +
    BIOME_PRESETS["warm-temperate-semiarid"][property] * semiaridWeight
  );
}

function dominantBiomeId(weights: Array<{ biomeId: BiomeId; weight: number }>): BiomeId {
  let dominant = weights[0];

  for (let index = 1; index < weights.length; index += 1) {
    if (weights[index].weight > dominant.weight) {
      dominant = weights[index];
    }
  }

  return dominant.biomeId;
}

/**
 * 当前 Qinling slice 的 Phase 1 只做纬度驱动：
 * - lat < 33.0：秦岭以南 / 四川盆地北缘，亚热带湿润深绿
 * - 33.0..34.5：秦岭主脊过渡带，soft blend 避免切出硬线
 * - 34.5 附近往北：关中暖温带黄绿
 * - 34.9..35.75：再向北渐入黄土边缘的偏黄半干旱
 *
 * 经度在当前切片内变化远小于南北差异，Phase 1 先忽略 lon；接口保留完整
 * GeographicCoordinate，Phase 2 可直接接全国更复杂 polygon / climate mask。
 */
export function biomeWeightsAt(coord: GeographicCoordinate): BiomeWeights {
  const southToNorth = smoothBlend(coord.lat, 33.0, 34.5);
  const northToSemiarid = smoothBlend(coord.lat, 34.9, 35.75);

  const southWeight = (1 - southToNorth) * (1 - northToSemiarid);
  const humidWeight = southToNorth * (1 - northToSemiarid);
  const semiaridWeight = northToSemiarid;

  return {
    biomeId: dominantBiomeId([
      { biomeId: "subtropical-humid", weight: southWeight },
      { biomeId: "warm-temperate-humid", weight: humidWeight },
      { biomeId: "warm-temperate-semiarid", weight: semiaridWeight }
    ]),
    hueShift: blendProperty(southWeight, humidWeight, semiaridWeight, "hueShift"),
    satScale: blendProperty(southWeight, humidWeight, semiaridWeight, "satScale"),
    lumScale: blendProperty(southWeight, humidWeight, semiaridWeight, "lumScale"),
    vegetationDensity: blendProperty(
      southWeight,
      humidWeight,
      semiaridWeight,
      "vegetationDensity"
    ),
    treeHue: blendProperty(southWeight, humidWeight, semiaridWeight, "treeHue")
  };
}
