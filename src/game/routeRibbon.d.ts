export interface RouteRibbonPoint {
  x: number;
  y: number;
}

export interface RouteRibbonOptions {
  width: number;
  yOffset?: number;
  sampleHeight: (x: number, z: number) => number;
}

export const qinlingRouteRibbonStyle: {
  width: number;
  yOffset: number;
  opacity: number;
};

export function buildRouteRibbonVertices(
  points: RouteRibbonPoint[],
  options: RouteRibbonOptions
): Float32Array;
