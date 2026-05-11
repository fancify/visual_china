import {
  projectGeoToWorld,
  unprojectWorldToGeo
} from "./mapOrientation.js";
import type { DemBounds, DemWorld } from "./demSampler";

export interface GeoPoint {
  lon: number;
  lat: number;
}

export interface WorldPoint {
  x: number;
  z: number;
}

export interface ExperienceDensityProfile {
  coordinatePolicy: "strict-geographic";
  travelSpeedMultiplier: number;
  cameraScaleMultiplier: number;
  detailDensityMultiplier: number;
  eventDensityMultiplier: number;
}

export const densityProfiles: Record<string, ExperienceDensityProfile> = {
  "high-focus": {
    coordinatePolicy: "strict-geographic",
    travelSpeedMultiplier: 1,
    cameraScaleMultiplier: 1,
    detailDensityMultiplier: 1,
    eventDensityMultiplier: 1
  },
  standard: {
    coordinatePolicy: "strict-geographic",
    travelSpeedMultiplier: 1.45,
    cameraScaleMultiplier: 1.18,
    detailDensityMultiplier: 0.72,
    eventDensityMultiplier: 0.72
  },
  sparse: {
    coordinatePolicy: "strict-geographic",
    travelSpeedMultiplier: 2.25,
    cameraScaleMultiplier: 1.42,
    detailDensityMultiplier: 0.42,
    eventDensityMultiplier: 0.38
  },
  "ultra-sparse": {
    coordinatePolicy: "strict-geographic",
    travelSpeedMultiplier: 3.4,
    cameraScaleMultiplier: 1.75,
    detailDensityMultiplier: 0.22,
    eventDensityMultiplier: 0.18
  }
};

/**
 * 把经纬度投影到世界坐标 (x, z)。委托给 mapOrientation——所有方向语义来自单一真相。
 */
export function geoToWorld(point: GeoPoint, bounds: DemBounds, world: DemWorld): WorldPoint {
  return projectGeoToWorld(point, bounds, world);
}

/**
 * 把世界坐标 (x, z) 反推回经纬度。
 */
export function worldToGeo(point: WorldPoint, bounds: DemBounds, world: DemWorld): GeoPoint {
  return unprojectWorldToGeo(point, bounds, world);
}

export function densityProfileForClass(densityClass?: string): ExperienceDensityProfile {
  return densityProfiles[densityClass ?? "standard"] ?? densityProfiles.standard;
}
