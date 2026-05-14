import type { LandMaskSampler } from "./landMaskRenderer.js";

interface GeographicBounds {
  west: number;
  east: number;
  south: number;
  north: number;
}

export function isCoastalL0Chunk(
  chunkX: number,
  chunkZ: number,
  chunkSizeDeg: number,
  bounds: GeographicBounds,
  landMaskSampler: LandMaskSampler | null | undefined
): boolean {
  if (!landMaskSampler) return false;
  const west = bounds.west + chunkX * chunkSizeDeg;
  const east = west + chunkSizeDeg;
  const north = bounds.north - chunkZ * chunkSizeDeg;
  const south = north - chunkSizeDeg;
  let landCount = 0;
  let oceanCount = 0;

  for (const u of [0, 0.5, 1]) {
    for (const v of [0, 0.5, 1]) {
      const lon = west + (east - west) * u;
      const lat = north - (north - south) * v;
      if (landMaskSampler.isLand(lon, lat)) landCount += 1;
      else oceanCount += 1;
      if (landCount > 0 && oceanCount > 0) return true;
    }
  }

  return false;
}

export function clampCoastalTargetTier(
  targetTier: number,
  chunkX: number,
  chunkZ: number,
  chunkSizeDeg: number,
  bounds: GeographicBounds,
  landMaskSampler: LandMaskSampler | null | undefined
): number {
  if (targetTier <= 1) return targetTier;
  return isCoastalL0Chunk(chunkX, chunkZ, chunkSizeDeg, bounds, landMaskSampler)
    ? 1
    : targetTier;
}
