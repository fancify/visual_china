import assert from "node:assert/strict";
import test from "node:test";

import {
  celestialDomeVector,
  skyBodyStyle,
  skyDomePolicy
} from "../src/game/skyDome.js";

test("sky dome is a camera-centered world object, not a screen-space layer", () => {
  assert.equal(skyDomePolicy.anchoring, "camera-centered");
  assert.equal(skyDomePolicy.renderSpace, "world-sky-dome");
  assert.equal(skyDomePolicy.screenSpace, false);
});

test("celestial bodies resolve to world dome vectors", () => {
  const noonSun = celestialDomeVector({ timeOfDay: 12, body: "sun", radius: 100 });
  const midnightMoon = celestialDomeVector({ timeOfDay: 0, body: "moon", radius: 100 });
  const sunsetSun = celestialDomeVector({ timeOfDay: 18, body: "sun", radius: 100 });

  assert.ok(noonSun.y > 70);
  assert.ok(midnightMoon.y > 70);
  assert.ok(Math.abs(sunsetSun.y) < 1e-9);
  assert.equal(noonSun.z, -42);
});

test("moon is rendered as a distant flat texture, not a nearby glowing sphere", () => {
  assert.equal(skyBodyStyle.moon.textureTreatment, "flat-distant-disc");
  assert.ok(skyBodyStyle.moon.maxScale <= 22);
  assert.ok(skyBodyStyle.moon.glowOpacity <= 0.16);
  assert.ok(skyBodyStyle.moon.radiusMultiplier >= 0.96);
});
