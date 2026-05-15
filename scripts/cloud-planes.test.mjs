import assert from "node:assert/strict";
import test from "node:test";
import { Color, Vector2 } from "three";

import {
  cloudVisualProfileForWeather,
  createCloudLayer,
  updateCloudLayer
} from "../src/game/cloudPlanes.ts";

test("cloud layer uses procedural patch planes with edge-faded texture metadata", () => {
  const layer = createCloudLayer();

  assert.equal(layer.planes.length, 12);
  assert.equal(layer.group.children.length, 12);
  assert.equal(layer.texture.userData.style, "botw-inspired-layered-cloud-mask");
  assert.equal(layer.texture.userData.patchSilhouette, "edge-faded");
  assert.ok(layer.texture.userData.coverageRatio > 0);
  assert.ok(layer.texture.userData.softEdgeRatio > 0);
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
    sunWarmColor: new Color("#ffe0aa"),
    skyZenithColor: new Color("#66aadd"),
    windDirection: new Vector2(1, 0),
    elapsedSeconds: 3,
    profile: cloudVisualProfileForWeather("clear"),
    daylight: 1
  });

  assert.ok(Math.abs(layer.group.position.x - 1.8) < 1e-9);
  assert.equal(layer.group.position.y, 2);
  assert.ok(Math.abs(layer.group.position.z + 3.6) < 1e-9);
  assert.notDeepEqual(layer.material.map.offset.toArray(), before.toArray());
  assert.equal(layer.material.opacity, 0.6 * cloudVisualProfileForWeather("clear").opacityMultiplier);
  const clearProfile = cloudVisualProfileForWeather("clear");
  const expected = new Color("#fff8dc")
    .lerp(new Color("#ffe0aa"), clearProfile.warmMix)
    .lerp(new Color("#66aadd"), clearProfile.zenithMix)
    .lerp(new Color("#ccddee"), clearProfile.horizonMix)
    .multiplyScalar(clearProfile.brightness);
  const actualRgb = layer.material.color.toArray();
  assert.ok(Math.abs(actualRgb[0] - expected.r) < 1e-6, `r ${actualRgb[0]} vs ${expected.r}`);
  assert.ok(Math.abs(actualRgb[1] - expected.g) < 1e-6, `g ${actualRgb[1]} vs ${expected.g}`);
  assert.ok(Math.abs(actualRgb[2] - expected.b) < 1e-6, `b ${actualRgb[2]} vs ${expected.b}`);
});

test("cloud profiles make storm clouds denser and lower than clear clouds", () => {
  const clear = cloudVisualProfileForWeather("clear");
  const storm = cloudVisualProfileForWeather("storm");

  assert.ok(storm.coverage > clear.coverage);
  assert.ok(storm.opacityMultiplier > clear.opacityMultiplier);
  assert.ok(storm.brightness < clear.brightness);
  assert.ok(storm.heightMultiplier < clear.heightMultiplier);
});

test("fair weather clouds fade out at night while storm cloud deck remains visible", () => {
  const layer = createCloudLayer();

  updateCloudLayer(layer, {
    playerPosition: { x: 0, y: 10, z: 0 },
    opacity: 0.5,
    farColor: new Color("#ccddee"),
    windDirection: new Vector2(1, 0),
    elapsedSeconds: 1,
    profile: cloudVisualProfileForWeather("clear"),
    daylight: 0
  });
  assert.equal(layer.group.visible, false);

  updateCloudLayer(layer, {
    playerPosition: { x: 0, y: 10, z: 0 },
    opacity: 0.5,
    farColor: new Color("#ccddee"),
    windDirection: new Vector2(1, 0),
    elapsedSeconds: 1,
    profile: cloudVisualProfileForWeather("storm"),
    daylight: 0
  });
  assert.equal(layer.group.visible, true);
});
