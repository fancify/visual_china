import assert from "node:assert/strict";
import test from "node:test";
import { Matrix4, Quaternion, Vector3 } from "three";

import { buildPlankRoad, disposePlankRoad } from "../src/game/plankRoadRenderer.ts";

function makeSampler(heightFn = () => 0) {
  return {
    sampleSurfaceHeight(x, z) {
      return heightFn(x, z);
    }
  };
}

function forwardVectorFromInstance(mesh, index) {
  const matrix = new Matrix4();
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();

  mesh.getMatrixAt(index, matrix);
  matrix.decompose(position, quaternion, scale);

  return new Vector3(1, 0, 0).applyQuaternion(quaternion).normalize();
}

test("plank road densifies a polyline into evenly spaced deck planks and sparse posts", () => {
  const handle = buildPlankRoad({
    points: [
      { x: 0, y: 0 },
      { x: 1.2, y: 0 },
      { x: 1.2, y: 0.8 }
    ],
    sampler: makeSampler()
  });

  assert.equal(handle.plankCount, 6);
  assert.equal(handle.plankMesh.count, 6);
  assert.equal("postCount" in handle, false);
  assert.equal("postMesh" in handle, false);

  disposePlankRoad(handle);
});

test("plank road orients deck planks to the local route tangent, stays near ground, and uses lighter wood", () => {
  const handle = buildPlankRoad({
    points: [
      { x: 0, y: 0 },
      { x: 1.2, y: 0 },
      { x: 1.2, y: 1.2 }
    ],
    sampler: makeSampler((x, z) => x * 0.25 + z * 0.5),
    plankSpacing: 0.4
  });

  const firstForward = forwardVectorFromInstance(handle.plankMesh, 0);
  const lastForward = forwardVectorFromInstance(handle.plankMesh, handle.plankCount - 1);

  assert.ok(firstForward.distanceTo(new Vector3(1, 0, 0)) < 1e-5);
  assert.ok(lastForward.distanceTo(new Vector3(0, 0, 1)) < 1e-5);

  const matrix = new Matrix4();
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  handle.plankMesh.getMatrixAt(2, matrix);
  matrix.decompose(position, quaternion, scale);

  const expectedLift = position.x * 0.25 + position.z * 0.5 + 0.02;
  assert.ok(Math.abs(position.y - expectedLift) < 1e-6);
  assert.ok(position.y - (position.x * 0.25 + position.z * 0.5) < 0.05);
  assert.equal(handle.plankMesh.material.color.getHex(), 0xb89372);

  disposePlankRoad(handle);
});
