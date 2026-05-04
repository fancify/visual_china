import {
  BoxGeometry,
  BufferGeometry,
  SphereGeometry
} from "three";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

export const CLOUD_MOUNT_COLOR = 0xe8e2f0;

export function buildCloudMountGeometry(): BufferGeometry {
  const parts: BufferGeometry[] = [];
  const positions: Array<[number, number, number, number]> = [
    [0, 0, 0, 0.55],
    [0.5, 0.05, -0.1, 0.42],
    [-0.5, 0.04, 0.1, 0.45],
    [0.18, 0.1, 0.4, 0.32],
    [-0.18, 0.08, -0.4, 0.34]
  ];

  for (const [x, y, z, radius] of positions) {
    const sphere = new SphereGeometry(radius, 8, 6);
    sphere.translate(x, y, z);
    parts.push(sphere);
  }

  const tail = new BoxGeometry(0.2, 0.08, 0.5);
  tail.translate(-0.02, 0.04, -0.82);
  parts.push(tail);

  const geometry = BufferGeometryUtils.mergeGeometries(parts);
  if (!geometry) {
    throw new Error("Failed to merge cloud mount geometry");
  }

  geometry.scale(0.724, 0.64, 0.72);
  geometry.computeVertexNormals();
  return geometry;
}
