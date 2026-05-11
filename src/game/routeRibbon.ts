export interface RouteRibbonPoint {
  x: number;
  y: number;
}

export interface RouteRibbonOptions {
  width: number;
  yOffset?: number;
  sampleHeight: (x: number, z: number) => number;
}

function normalize2D(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y);

  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return { x: x / length, y: y / length };
}

export const qinlingRouteRibbonStyle: {
  width: number;
  yOffset: number;
  opacity: number;
} = {
  width: 2.6,
  yOffset: 0.9,
  opacity: 0.1
};

export function buildRouteRibbonVertices(
  points: RouteRibbonPoint[],
  options: RouteRibbonOptions
): Float32Array {
  const width = options.width;
  const halfWidth = width * 0.5;
  const yOffset = options.yOffset ?? 0;
  const vertices: number[] = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const direction = normalize2D(end.x - start.x, end.y - start.y);
    const normal = {
      x: -direction.y * halfWidth,
      y: direction.x * halfWidth
    };
    const startLeft = { x: start.x + normal.x, z: start.y + normal.y };
    const startRight = { x: start.x - normal.x, z: start.y - normal.y };
    const endLeft = { x: end.x + normal.x, z: end.y + normal.y };
    const endRight = { x: end.x - normal.x, z: end.y - normal.y };

    const pushVertex = (point: { x: number; z: number }) => {
      vertices.push(
        point.x,
        options.sampleHeight(point.x, point.z) + yOffset,
        point.z
      );
    };

    pushVertex(startLeft);
    pushVertex(startRight);
    pushVertex(endLeft);
    pushVertex(startRight);
    pushVertex(endRight);
    pushVertex(endLeft);
  }

  return new Float32Array(vertices);
}
