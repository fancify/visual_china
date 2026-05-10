export type GrassDensity = "none" | "sparse" | "normal" | "lush";

export const GRASS_DENSITY_MULTIPLIER: Record<GrassDensity, number>;

export function grassDensityAt(
  worldX: number,
  worldZ: number,
  elevation: number,
  geoLat: number,
  geoLon: number
): GrassDensity;
