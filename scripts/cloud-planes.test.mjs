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
  // Audit-fix B1 (2026-05-11): material color 不再直接 = farColor (会让云完全融入天空)，
  // 改为 lerp(near-white #f8fcff, farColor, 0.6) 让云保留 highlight。
  const expected = new Color(0xf8fcff).lerp(new Color("#ccddee"), 0.6);
  const actualRgb = layer.material.color.toArray();
  assert.ok(Math.abs(actualRgb[0] - expected.r) < 1e-6, `r ${actualRgb[0]} vs ${expected.r}`);
  assert.ok(Math.abs(actualRgb[1] - expected.g) < 1e-6, `g ${actualRgb[1]} vs ${expected.g}`);
  assert.ok(Math.abs(actualRgb[2] - expected.b) < 1e-6, `b ${actualRgb[2]} vs ${expected.b}`);
});
