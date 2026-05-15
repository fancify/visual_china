import { MathUtils } from "three";

export type ClimateZone =
  | "temperate-inland"
  | "jiangnan-water"
  | "north-china-plain"
  | "western-dryland"
  | "mongolian-plateau"
  | "qinling-bashu-mountain"
  | "tibetan-plateau";

export interface ClimateContext {
  zone: ClimateZone;
  latitude: number;
  elevationMeters: number;
  waterProximity: number;
  humidity: number;
  aridity: number;
}

export interface ClimateVisualModifiers {
  fogDensityMul: number;
  mistOpacityAdd: number;
  cloudOpacityAdd: number;
  starVisibilityMul: number;
  milkyWayVisibilityMul: number;
  dryHazeAdd: number;
}

export interface ClimateContextOverrides {
  elevationMeters?: number;
  waterProximity?: number;
}

const CLIMATE_GEO_BOUNDS = {
  west: 73,
  east: 135,
  south: 18,
  north: 53
};

const CLIMATE_WORLD_DIMENSIONS = {
  width: 1711,
  depth: 1186
};

function clamp01(value: number): number {
  return MathUtils.clamp(value, 0, 1);
}

function climateGeoForWorldPosition(x: number, z: number): { lat: number; lon: number } {
  const u = MathUtils.clamp(
    (x + CLIMATE_WORLD_DIMENSIONS.width / 2) / CLIMATE_WORLD_DIMENSIONS.width,
    0,
    1
  );
  const v = MathUtils.clamp(
    (z + CLIMATE_WORLD_DIMENSIONS.depth / 2) / CLIMATE_WORLD_DIMENSIONS.depth,
    0,
    1
  );

  return {
    lon: MathUtils.lerp(CLIMATE_GEO_BOUNDS.west, CLIMATE_GEO_BOUNDS.east, u),
    lat: MathUtils.lerp(CLIMATE_GEO_BOUNDS.north, CLIMATE_GEO_BOUNDS.south, v)
  };
}

export function defaultClimateContext(): ClimateContext {
  return {
    zone: "temperate-inland",
    latitude: 34.3,
    elevationMeters: 600,
    waterProximity: 0.28,
    humidity: 0.48,
    aridity: 0.34
  };
}

export function climateVisualModifiers(context: ClimateContext): ClimateVisualModifiers {
  const humidity = clamp01(context.humidity);
  const aridity = clamp01(context.aridity);
  const water = clamp01(context.waterProximity);
  const elevation = clamp01(context.elevationMeters / 4500);
  const wetness = clamp01(humidity * 0.72 + water * 0.28);
  const dryAir = clamp01(aridity * 0.78 + (1 - humidity) * 0.22);

  return {
    fogDensityMul: MathUtils.lerp(0.88, 1.28, wetness),
    mistOpacityAdd: wetness * 0.035,
    cloudOpacityAdd: wetness * 0.12 - dryAir * 0.045,
    starVisibilityMul: MathUtils.clamp(1.08 + elevation * 0.22 - wetness * 0.32, 0.62, 1.28),
    milkyWayVisibilityMul: MathUtils.clamp(1.04 + elevation * 0.34 - wetness * 0.4, 0.52, 1.34),
    dryHazeAdd: dryAir * 0.018
  };
}

export function climateContextForGeo(
  latitude: number,
  longitude: number,
  overrides: ClimateContextOverrides = {}
): ClimateContext {
  const elevationMeters = Number.isFinite(overrides.elevationMeters)
    ? overrides.elevationMeters!
    : 600;
  const waterProximity = clamp01(
    Number.isFinite(overrides.waterProximity) ? overrides.waterProximity! : 0.22
  );

  if (
    elevationMeters >= 3200 ||
    (longitude >= 78 &&
      longitude <= 103 &&
      latitude >= 28 &&
      latitude <= 37 &&
      elevationMeters >= 2200)
  ) {
    return {
      zone: "tibetan-plateau",
      latitude,
      elevationMeters,
      waterProximity,
      humidity: 0.22 + waterProximity * 0.12,
      aridity: 0.58
    };
  }

  if (longitude < 98) {
    return {
      zone: "western-dryland",
      latitude,
      elevationMeters,
      waterProximity,
      humidity: 0.08 + waterProximity * 0.1,
      aridity: 0.88
    };
  }

  if (latitude >= 40 && longitude >= 95 && longitude <= 125) {
    return {
      zone: "mongolian-plateau",
      latitude,
      elevationMeters,
      waterProximity,
      humidity: 0.24 + waterProximity * 0.14,
      aridity: 0.66
    };
  }

  if (latitude >= 24 && latitude <= 32.5 && longitude >= 108 && longitude <= 123) {
    return {
      zone: "jiangnan-water",
      latitude,
      elevationMeters,
      waterProximity: Math.max(waterProximity, 0.58),
      humidity: 0.78,
      aridity: 0.12
    };
  }

  if (latitude >= 30 && latitude <= 35.8 && longitude >= 102 && longitude <= 112.5) {
    return {
      zone: "qinling-bashu-mountain",
      latitude,
      elevationMeters,
      waterProximity,
      humidity: 0.58 + waterProximity * 0.18,
      aridity: 0.24
    };
  }

  if (latitude >= 34 && latitude <= 41.5 && longitude >= 105 && longitude <= 122) {
    return {
      zone: "north-china-plain",
      latitude,
      elevationMeters,
      waterProximity,
      humidity: 0.38 + waterProximity * 0.16,
      aridity: 0.44
    };
  }

  return {
    zone: "temperate-inland",
    latitude,
    elevationMeters,
    waterProximity,
    humidity: 0.46 + waterProximity * 0.14,
    aridity: 0.34
  };
}

export function climateContextForWorldPosition(
  x: number,
  z: number,
  overrides: ClimateContextOverrides = {}
): ClimateContext {
  const geo = climateGeoForWorldPosition(x, z);
  return climateContextForGeo(geo.lat, geo.lon, overrides);
}

export function climateContextForZone(
  zone: ClimateZone,
  base: ClimateContext = defaultClimateContext()
): ClimateContext {
  switch (zone) {
    case "jiangnan-water":
      return { ...base, zone, waterProximity: 0.92, humidity: 0.86, aridity: 0.08 };
    case "western-dryland":
      return { ...base, zone, waterProximity: 0.04, humidity: 0.08, aridity: 0.92 };
    case "mongolian-plateau":
      return { ...base, zone, waterProximity: 0.12, humidity: 0.26, aridity: 0.68 };
    case "north-china-plain":
      return { ...base, zone, waterProximity: 0.24, humidity: 0.42, aridity: 0.42 };
    case "qinling-bashu-mountain":
      return { ...base, zone, waterProximity: 0.38, humidity: 0.68, aridity: 0.22 };
    case "tibetan-plateau":
      return {
        ...base,
        zone,
        elevationMeters: Math.max(base.elevationMeters, 3600),
        waterProximity: 0.08,
        humidity: 0.2,
        aridity: 0.62
      };
    case "temperate-inland":
    default:
      return { ...base, zone, waterProximity: 0.28, humidity: 0.48, aridity: 0.34 };
  }
}
