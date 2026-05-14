import type { LandMaskSampler } from "./landMaskRenderer.js";
import { unprojectWorldToGeo } from "../mapOrientation.js";
import { qinlingRegionWorld } from "../../data/qinlingRegion.js";

interface GeographicBounds {
  west: number;
  east: number;
  south: number;
  north: number;
}

export interface ChunkIndexRange {
  xMin: number;
  xMax: number;
  zMin: number;
  zMax: number;
}

export function l0ChunkWindowForCamera(
  cameraX: number,
  cameraZ: number,
  viewRadiusUnits: number,
  chunkSizeDeg: number,
  bounds: GeographicBounds,
  fullRange: ChunkIndexRange
): ChunkIndexRange {
  const westGeo = unprojectWorldToGeo(
    { x: cameraX - viewRadiusUnits, z: cameraZ },
    bounds,
    qinlingRegionWorld
  );
  const eastGeo = unprojectWorldToGeo(
    { x: cameraX + viewRadiusUnits, z: cameraZ },
    bounds,
    qinlingRegionWorld
  );
  const northGeo = unprojectWorldToGeo(
    { x: cameraX, z: cameraZ - viewRadiusUnits },
    bounds,
    qinlingRegionWorld
  );
  const southGeo = unprojectWorldToGeo(
    { x: cameraX, z: cameraZ + viewRadiusUnits },
    bounds,
    qinlingRegionWorld
  );
  const west = Math.min(westGeo.lon, eastGeo.lon);
  const east = Math.max(westGeo.lon, eastGeo.lon);
  const north = Math.max(northGeo.lat, southGeo.lat);
  const south = Math.min(northGeo.lat, southGeo.lat);

  return {
    xMin: Math.max(fullRange.xMin, Math.floor((west - bounds.west) / chunkSizeDeg) - 1),
    xMax: Math.min(fullRange.xMax, Math.floor((east - bounds.west) / chunkSizeDeg) + 1),
    zMin: Math.max(fullRange.zMin, Math.floor((bounds.north - north) / chunkSizeDeg) - 1),
    zMax: Math.min(fullRange.zMax, Math.floor((bounds.north - south) / chunkSizeDeg) + 1)
  };
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
  void chunkX;
  void chunkZ;
  void chunkSizeDeg;
  void bounds;
  void landMaskSampler;
  return targetTier;
}
