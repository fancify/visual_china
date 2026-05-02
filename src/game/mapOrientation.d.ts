export interface MapDirectionVector {
  readonly x: number;
  readonly z: number;
}

export interface MapOrientationContract {
  readonly northAxis: "-z";
  readonly eastAxis: "+x";
  readonly description: string;
}

export interface GeoPoint {
  lon: number;
  lat: number;
}

export interface WorldPoint {
  x: number;
  z: number;
}

export interface CanvasPixel {
  x: number;
  y: number;
}

export interface WorldDimensions {
  width: number;
  depth: number;
}

export interface CanvasDimensions {
  width: number;
  height: number;
}

export interface GeoBounds {
  west: number;
  east: number;
  south: number;
  north: number;
}

export const MAP_NORTH: MapDirectionVector;
export const MAP_SOUTH: MapDirectionVector;
export const MAP_EAST: MapDirectionVector;
export const MAP_WEST: MapDirectionVector;
export const MAP_ORIENTATION_CONTRACT: MapOrientationContract;

export function projectGeoToWorld(
  geo: GeoPoint,
  bounds: GeoBounds,
  world: WorldDimensions
): WorldPoint;

export function unprojectWorldToGeo(
  point: WorldPoint,
  bounds: GeoBounds,
  world: WorldDimensions
): GeoPoint;

export function projectWorldToAtlasPixel(
  point: WorldPoint,
  world: WorldDimensions,
  canvas: CanvasDimensions
): CanvasPixel;

export function unprojectAtlasPixelToWorld(
  pixel: CanvasPixel,
  world: WorldDimensions,
  canvas: CanvasDimensions
): WorldPoint;

export function latitudeAtRow(
  row: number,
  rows: number,
  bounds: { south: number; north: number }
): number;

export function longitudeAtColumn(
  column: number,
  columns: number,
  bounds: { west: number; east: number }
): number;
