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

export const densityProfiles: Record<string, ExperienceDensityProfile>;

export function geoToWorld(
  point: GeoPoint,
  bounds: DemBounds,
  world: DemWorld
): WorldPoint;

export function worldToGeo(
  point: WorldPoint,
  bounds: DemBounds,
  world: DemWorld
): GeoPoint;

export function densityProfileForClass(
  densityClass?: string
): ExperienceDensityProfile;
