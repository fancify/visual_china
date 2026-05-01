import assert from "node:assert/strict";
import test from "node:test";

import {
  celestialDiscPosition,
  celestialDomeCameraOffset
} from "../src/game/celestial.js";

test("sun and moon positions are expressed as sky-dome CSS percentages", () => {
  const noonSun = celestialDiscPosition({ timeOfDay: 12, body: "sun" });
  const midnightMoon = celestialDiscPosition({ timeOfDay: 0, body: "moon" });
  const sunsetSun = celestialDiscPosition({ timeOfDay: 18, body: "sun" });

  assert.equal(noonSun.unit, "sky-dome-css");
  assert.equal(midnightMoon.unit, "sky-dome-css");
  assert.ok(noonSun.top < 18, "noon sun should sit high on the sky texture");
  assert.ok(midnightMoon.top < 18, "midnight moon should sit high on the sky texture");
  assert.ok(noonSun.left > 44 && noonSun.left < 56);
  assert.ok(midnightMoon.left > 44 && midnightMoon.left < 56);
  assert.ok(sunsetSun.top > noonSun.top, "sunset should sit lower on the dome than noon");
  assert.ok(sunsetSun.scale < noonSun.scale, "horizon bodies should feel farther away on the dome");
});

test("sky dome shifts with camera heading", () => {
  const forward = celestialDomeCameraOffset({ cameraHeading: 0 });
  const turnedRight = celestialDomeCameraOffset({ cameraHeading: Math.PI / 2 });
  const turnedLeft = celestialDomeCameraOffset({ cameraHeading: -Math.PI / 2 });

  assert.equal(forward.unit, "vw");
  assert.equal(forward.x, 0);
  assert.ok(turnedRight.x < forward.x);
  assert.ok(turnedLeft.x > forward.x);
});
