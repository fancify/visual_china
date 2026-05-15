import assert from "node:assert/strict";
import test from "node:test";

import {
  celestialDomeVector,
  northernCelestialPole,
  skyBodyStyle,
  skyDomePolicy,
  starDomeSiderealAngle
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
  assert.equal(skyBodyStyle.moon.minScale, 22.5);
  assert.equal(skyBodyStyle.moon.maxScale, 31.5);
  assert.ok(skyBodyStyle.moon.glowOpacity <= 0.16);
  assert.ok(skyBodyStyle.moon.radiusMultiplier <= 0.9);
});

test("star dome exposes a northern-celestial-pole sidereal rotation model", () => {
  assert.ok(Math.abs(northernCelestialPole.length() - 1) < 1e-9);
  assert.ok(northernCelestialPole.y > 0.5);
  assert.ok(northernCelestialPole.z < -0.7);

  const midnight = starDomeSiderealAngle({ timeOfDay: 0, dayCount: 0 });
  const noon = starDomeSiderealAngle({ timeOfDay: 12, dayCount: 0 });
  assert.ok(Math.abs(noon - Math.PI) < 1e-9);

  const nextNight = starDomeSiderealAngle({ timeOfDay: 0, dayCount: 1 });
  assert.ok(nextNight > 0 && nextNight < 0.03);
  assert.notEqual(nextNight, midnight);
});
