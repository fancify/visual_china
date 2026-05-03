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

test("sunset keeps stars hidden until the sun is meaningfully below the horizon", () => {
  const sunset = celestialCycle({
    timeOfDay: 18,
    weatherSunCut: 0,
    fogBoost: 0,
    windStrength: 0.28
  });
  const lateDusk = celestialCycle({
    timeOfDay: 19,
    weatherSunCut: 0,
    fogBoost: 0,
    windStrength: 0.28
  });

  assert.ok(sunset.starOpacity <= 0.05, "sunset should not reveal stars yet");
  assert.ok(lateDusk.starOpacity > sunset.starOpacity, "stars should rise after sunset, not at it");
});

test("sunrise clears stars quickly and deep night allows an opaque moon", () => {
  const sunrise = celestialCycle({
    timeOfDay: 6,
    weatherSunCut: 0,
    fogBoost: 0,
    windStrength: 0.28
  });
  const predawn = celestialCycle({
    timeOfDay: 5,
    weatherSunCut: 0,
    fogBoost: 0,
    windStrength: 0.28
  });
  const midnight = celestialCycle({
    timeOfDay: 0,
    weatherSunCut: 0,
    fogBoost: 0,
    windStrength: 0.28
  });

  assert.ok(sunrise.starOpacity <= 0.05, "sunrise should collapse star visibility");
  assert.ok(predawn.starOpacity > sunrise.starOpacity, "predawn should still carry visible stars");
  assert.equal(midnight.moonOpacity, 1, "deep night moon should be fully opaque");
});
