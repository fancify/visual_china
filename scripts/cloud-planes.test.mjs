import assert from "node:assert/strict";
import test from "node:test";
import { Color, Vector2 } from "three";

import { createCloudLayer, updateCloudLayer } from "../src/game/cloudPlanes.ts";

test("cloud layer uses three procedural horizontal planes at playable heights", () => {
  const layer = createCloudLayer();

  assert.equal(layer.planes.length, 3);
  assert.deepEqual(layer.planes.map((plane) => plane.userData.heightOffset), [8, 12, 16]);
  assert.equal(layer.group.children.length, 3);
  assert.equal(layer.material.depthWrite, false);
  assert.equal(layer.material.transparent, true);
});

test("cloud layer update follows player and scrolls by wind", () => {
  const layer = createCloudLayer();
  const before = layer.material.map.offset.clone();

  updateCloudLayer(layer, {
    playerPosition: { x: 10, y: 2, z: -20 },
    opacity: 0.6,
    farColor: new Color("#ccddee"),
    windDirection: new Vector2(1, 0),
    elapsedSeconds: 3
  });

  assert.ok(Math.abs(layer.group.position.x - 1.8) < 1e-9);
  assert.equal(layer.group.position.y, 2);
  assert.ok(Math.abs(layer.group.position.z + 3.6) < 1e-9);
  assert.notDeepEqual(layer.material.map.offset.toArray(), before.toArray());
  assert.equal(layer.material.opacity, 0.6);
  assert.deepEqual(layer.material.color.toArray(), new Color("#ccddee").toArray());
});
