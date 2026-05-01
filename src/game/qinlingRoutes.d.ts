export interface RoutePoint {
  x: number;
  y: number;
}

export interface QinlingRoute {
  id: string;
  name: string;
  label?: string;
  description: string;
  labelPoint?: RoutePoint;
  points: RoutePoint[];
}

export interface RouteInfluence {
  affinity: number;
  distance: number;
  nearestRoute: QinlingRoute | null;
}

export const qinlingRoutes: QinlingRoute[];

export function routeAffinityAt(
  point: RoutePoint,
  maxDistance?: number
): RouteInfluence;
