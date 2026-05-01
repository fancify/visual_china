import assert from "node:assert/strict";
import test from "node:test";

import { celestialCycle } from "../src/game/celestial.js";

test("clear night stays readable and exposes moon, stars, and clouds", () => {
  const visuals = celestialCycle({
    timeOfDay: 23,
    weatherSunCut: 0,
    fogBoost: 0,
    windStrength: 0.28
  });

  assert.ok(visuals.nightReadability >= 0.55);
  assert.ok(visuals.terrainLightnessFloor >= 1.12);
  assert.ok(visuals.moonOpacity >= 0.5);
  assert.ok(visuals.starOpacity >= 0.55);
  assert.ok(visuals.cloudOpacity >= 0.18);
  assert.ok(visuals.sunDiscOpacity < 0.1);
});

test("daytime shows sun and keeps clouds visible", () => {
  const visuals = celestialCycle({
    timeOfDay: 13,
    weatherSunCut: 0,
    fogBoost: 0,
    windStrength: 0.28
  });

  assert.ok(visuals.sunDiscOpacity >= 0.65);
  assert.ok(visuals.moonOpacity < 0.2);
  assert.ok(visuals.cloudOpacity >= 0.14);
});
