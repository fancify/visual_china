export interface CameraMapPoint {
  x: number;
  y: number;
}

export interface CameraMapWorld {
  width: number;
  depth: number;
}

export interface CameraMapCanvas {
  width: number;
  height: number;
}

export interface CameraMapBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export function cameraAlignedWorldToCanvasPoint(
  point: CameraMapPoint,
  world: CameraMapWorld,
  canvas: CameraMapCanvas,
  heading: number
): CameraMapPoint;

export function cameraAlignedCanvasToWorldPoint(
  point: CameraMapPoint,
  world: CameraMapWorld,
  canvas: CameraMapCanvas,
  heading: number
): CameraMapPoint;

export function cameraAlignedWorldBounds(
  world: CameraMapWorld,
  heading: number
): CameraMapBounds;
