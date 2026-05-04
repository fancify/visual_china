import { MathUtils } from "three";

// `public/china-rivers-prototype.html` 需要直接 import 这份浏览器原生 module，
// 所以 zone data 放在 public/；这里用同一份运行时数据，避免维护两张表。
// @ts-ignore public runtime module is intentionally shared with the static prototype page.
import biomeZoneDataRaw, { SEASONAL_PALETTE as seasonalPaletteRaw } from "../../public/data/biome-zones.js";
import type { GeoPoint as GeographicCoordinate } from "./mapOrientation.js";

export type { GeographicCoordinate };

export type BiomeId =
  | "subtropical-humid"
  | "tropical-humid"
  | "warm-temperate-humid"
  | "warm-temperate-semiarid"
  | "northeast-cold-humid"
  | "temperate-grassland"
  | "arid-desert"
  | "alpine-meadow";

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

export interface SeasonalBlend {
  spring: number;
  summer: number;
  autumn: number;
  winter: number;
}

interface BiomePreset extends Omit<BiomeWeights, "biomeId"> {}

interface SeasonalPaletteEntry {
  hueShift: number;
  satScale: number;
  lumScale: number;
  vegDensity: number;
  treeHueShift: number;
}

interface SmoothRange {
  start: number;
  end: number;
}

interface QinlingSliceBounds {
  west: number;
  east: number;
  south: number;
  north: number;
}

interface NationwideRegion {
  name: string;
  west: number;
  east: number;
  south: number;
  north: number;
  feather: number;
}

interface NationwideZone {
  biomeId: Exclude<BiomeId, "warm-temperate-semiarid">;
  regions: NationwideRegion[];
}

interface BiomeZoneData {
  qinlingSlice: QinlingSliceBounds;
  phase1: {
    southToNorth: SmoothRange;
    northToSemiarid: SmoothRange;
  };
  presets: Record<BiomeId, BiomePreset>;
  nationwideZones: NationwideZone[];
}

const BIOME_ZONE_DATA = biomeZoneDataRaw as BiomeZoneData;
const BIOME_PRESETS = BIOME_ZONE_DATA.presets;
const SEASONAL_PALETTE = seasonalPaletteRaw as Record<
  keyof SeasonalBlend,
  SeasonalPaletteEntry
>;
const BIOME_PROPERTIES: Array<keyof Omit<BiomeWeights, "biomeId">> = [
  "hueShift",
  "satScale",
  "lumScale",
  "vegetationDensity",
  "treeHue"
];

function smoothBlend(value: number, start: number, end: number): number {
  if (value <= start) {
    return 0;
  }

  if (value >= end) {
    return 1;
  }

  return MathUtils.smoothstep(value, start, end);
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

function blendByWeights(weights: Array<{ biomeId: BiomeId; weight: number }>): BiomeWeights {
  const biome = {
    biomeId: dominantBiomeId(weights),
    hueShift: 0,
    satScale: 0,
    lumScale: 0,
    vegetationDensity: 0,
    treeHue: 0
  } satisfies BiomeWeights;

  for (const property of BIOME_PROPERTIES) {
    biome[property] = weights.reduce((sum, entry) => {
      return sum + BIOME_PRESETS[entry.biomeId][property] * entry.weight;
    }, 0);
  }

  return biome;
}

function isInsideSlice(coord: GeographicCoordinate, slice: QinlingSliceBounds): boolean {
  return (
    coord.lon >= slice.west &&
    coord.lon <= slice.east &&
    coord.lat >= slice.south &&
    coord.lat <= slice.north
  );
}

function phase1Weights(coord: GeographicCoordinate): BiomeWeights {
  const southToNorth = smoothBlend(
    coord.lat,
    BIOME_ZONE_DATA.phase1.southToNorth.start,
    BIOME_ZONE_DATA.phase1.southToNorth.end
  );
  const northToSemiarid = smoothBlend(
    coord.lat,
    BIOME_ZONE_DATA.phase1.northToSemiarid.start,
    BIOME_ZONE_DATA.phase1.northToSemiarid.end
  );

  const southWeight = (1 - southToNorth) * (1 - northToSemiarid);
  const humidWeight = southToNorth * (1 - northToSemiarid);
  const semiaridWeight = northToSemiarid;

  return blendByWeights([
    { biomeId: "subtropical-humid", weight: southWeight },
    { biomeId: "warm-temperate-humid", weight: humidWeight },
    { biomeId: "warm-temperate-semiarid", weight: semiaridWeight }
  ]);
}

function axisWindow(value: number, min: number, max: number, feather: number): number {
  if (value <= min - feather || value >= max + feather) {
    return 0;
  }

  const enter =
    feather <= 0
      ? value >= min
        ? 1
        : 0
      : smoothBlend(value, min - feather, min);
  const exit =
    feather <= 0
      ? value <= max
        ? 1
        : 0
      : 1 - smoothBlend(value, max, max + feather);

  return Math.min(enter, exit);
}

function regionWeight(coord: GeographicCoordinate, region: NationwideRegion): number {
  return (
    axisWindow(coord.lon, region.west, region.east, region.feather) *
    axisWindow(coord.lat, region.south, region.north, region.feather)
  );
}

function normalizedNationwideWeights(
  coord: GeographicCoordinate
): Array<{ biomeId: BiomeId; weight: number }> {
  const rawWeights = BIOME_ZONE_DATA.nationwideZones
    .map((zone) => ({
      biomeId: zone.biomeId,
      weight: zone.regions.reduce((maxWeight, region) => {
        return Math.max(maxWeight, regionWeight(coord, region));
      }, 0)
    }))
    .filter((entry) => entry.weight > 0.0001) as Array<{ biomeId: BiomeId; weight: number }>;

  if (rawWeights.length === 0) {
    return [{ biomeId: fallbackBiomeId(coord), weight: 1 }];
  }

  const totalWeight = rawWeights.reduce((sum, entry) => sum + entry.weight, 0);

  return rawWeights.map((entry) => ({
    biomeId: entry.biomeId,
    weight: entry.weight / totalWeight
  }));
}

function fallbackBiomeId(coord: GeographicCoordinate): BiomeId {
  if (coord.lat < 22) {
    return "tropical-humid";
  }

  if (
    coord.lat >= 28 &&
    coord.lat <= 37 &&
    coord.lon >= 78 &&
    coord.lon <= 103
  ) {
    return "alpine-meadow";
  }

  if (coord.lon < 95) {
    return "arid-desert";
  }

  if (coord.lat > 42 && coord.lon > 118) {
    return "northeast-cold-humid";
  }

  if (coord.lat >= 39 && coord.lat <= 46 && coord.lon >= 100 && coord.lon <= 118) {
    return "temperate-grassland";
  }

  if (coord.lat < 34) {
    return "subtropical-humid";
  }

  return "warm-temperate-humid";
}

function blendedSeasonalPalette(seasonalBlend: SeasonalBlend): SeasonalPaletteEntry {
  return (Object.keys(SEASONAL_PALETTE) as Array<keyof SeasonalBlend>).reduce(
    (blended, season) => {
      const weight = seasonalBlend[season];
      const palette = SEASONAL_PALETTE[season];

      blended.hueShift += palette.hueShift * weight;
      blended.satScale += palette.satScale * weight;
      blended.lumScale += palette.lumScale * weight;
      blended.vegDensity += palette.vegDensity * weight;
      blended.treeHueShift += palette.treeHueShift * weight;
      return blended;
    },
    {
      hueShift: 0,
      satScale: 0,
      lumScale: 0,
      vegDensity: 0,
      treeHueShift: 0
    } satisfies SeasonalPaletteEntry
  );
}

export function applySeasonalAdjustment(
  baseWeights: BiomeWeights,
  seasonalBlend: SeasonalBlend
): BiomeWeights {
  const palette = blendedSeasonalPalette(seasonalBlend);

  return {
    ...baseWeights,
    hueShift: baseWeights.hueShift + palette.hueShift,
    satScale: baseWeights.satScale * palette.satScale,
    lumScale: baseWeights.lumScale * palette.lumScale,
    vegetationDensity: baseWeights.vegetationDensity * palette.vegDensity,
    treeHue: MathUtils.euclideanModulo(baseWeights.treeHue + palette.treeHueShift, 1)
  };
}

/**
 * Phase 2:
 * - Qinling slice 内保持 Phase 1 行为不变，仍然只用纬度 soft blend。
 * - slice 外按全国简化 ecoregion rectangle/polygon 规则走，并在边界处做 smoothstep。
 */
export function biomeWeightsAt(coord: GeographicCoordinate): BiomeWeights {
  if (isInsideSlice(coord, BIOME_ZONE_DATA.qinlingSlice)) {
    return phase1Weights(coord);
  }

  return blendByWeights(normalizedNationwideWeights(coord));
}
