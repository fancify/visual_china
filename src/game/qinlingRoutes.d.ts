export interface RoutePoint {
  x: number;
  y: number;
}

export interface QinlingRoute {
  id: string;
  name: string;
  source?: {
    name?: string;
    verification?:
      | "unverified"
      | "external-vector"
      | "verified"
      | "historical-references";
  };
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
  maxDistance?: number,
  options?: { includeUnverifiedRoutes?: boolean }
): RouteInfluence;
