import { cameraForwardVector, cameraRightVector } from "./navigation.js";

function cameraSpaceBounds(world, heading) {
  const right = cameraRightVector(heading);
  const forward = cameraForwardVector(heading);
  const corners = [
    { x: -world.width / 2, y: -world.depth / 2 },
    { x: world.width / 2, y: -world.depth / 2 },
    { x: world.width / 2, y: world.depth / 2 },
    { x: -world.width / 2, y: world.depth / 2 }
  ].map((point) => ({
    x: point.x * right.x + point.y * right.z,
    y: point.x * forward.x + point.y * forward.z
  }));

  return {
    minX: Math.min(...corners.map((point) => point.x)),
    maxX: Math.max(...corners.map((point) => point.x)),
    minY: Math.min(...corners.map((point) => point.y)),
    maxY: Math.max(...corners.map((point) => point.y)),
    right,
    forward
  };
}

export function cameraAlignedWorldToCanvasPoint(point, world, canvas, heading) {
  const bounds = cameraSpaceBounds(world, heading);
  const cameraX = point.x * bounds.right.x + point.y * bounds.right.z;
  const cameraY = point.x * bounds.forward.x + point.y * bounds.forward.z;

  return {
    x: ((cameraX - bounds.minX) / (bounds.maxX - bounds.minX || 1)) * canvas.width,
    y: (1 - (cameraY - bounds.minY) / (bounds.maxY - bounds.minY || 1)) * canvas.height
  };
}

export function cameraAlignedCanvasToWorldPoint(point, world, canvas, heading) {
  const bounds = cameraSpaceBounds(world, heading);
  const cameraX = bounds.minX + (point.x / canvas.width) * (bounds.maxX - bounds.minX);
  const cameraY =
    bounds.minY + (1 - point.y / canvas.height) * (bounds.maxY - bounds.minY);

  return {
    x: cameraX * bounds.right.x + cameraY * bounds.forward.x,
    y: cameraX * bounds.right.z + cameraY * bounds.forward.z
  };
}

export function cameraAlignedWorldBounds(world, heading) {
  const bounds = cameraSpaceBounds(world, heading);

  return {
    minX: bounds.minX,
    maxX: bounds.maxX,
    minY: bounds.minY,
    maxY: bounds.maxY
  };
}
