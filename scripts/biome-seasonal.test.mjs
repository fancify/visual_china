import assert from "node:assert/strict";
import test from "node:test";

import {
  applySeasonalAdjustment,
  biomeWeightsAt
} from "../src/game/biomeZones.ts";
import { seasonalBlendAtDayOfYear } from "../src/game/environment.ts";

function assertClose(actual, expected, epsilon = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

test("spring seasonal palette lifts luminance over the summer baseline", () => {
  const summerBaseline = biomeWeightsAt({ lat: 32, lon: 107 });
  const spring = applySeasonalAdjustment(summerBaseline, {
    spring: 1,
    summer: 0,
    autumn: 0,
    winter: 0
  });

  assert.ok(spring.lumScale > summerBaseline.lumScale);
  assert.ok(spring.satScale < summerBaseline.satScale);
});

test("winter seasonal palette desaturates and thins vegetation against the summer baseline", () => {
  const summerBaseline = biomeWeightsAt({ lat: 35, lon: 116 });
  const winter = applySeasonalAdjustment(summerBaseline, {
    spring: 0,
    summer: 0,
    autumn: 0,
    winter: 1
  });

  assert.ok(winter.satScale < summerBaseline.satScale);
  assert.ok(winter.vegetationDensity < summerBaseline.vegetationDensity);
});

test("spring to summer boundary soft-blends evenly at day 152", () => {
  const blend = seasonalBlendAtDayOfYear(152);

  assertClose(blend.spring, 0.5);
  assertClose(blend.summer, 0.5);
  assertClose(blend.autumn, 0);
  assertClose(blend.winter, 0);
});

test("day 0 resolves to full winter weight", () => {
  const blend = seasonalBlendAtDayOfYear(0);

  assertClose(blend.spring, 0);
  assertClose(blend.summer, 0);
  assertClose(blend.autumn, 0);
  assertClose(blend.winter, 1);
});

test("biome baseline plus seasonal adjustment preserves biome identity while warming autumn tones", () => {
  const base = biomeWeightsAt({ lat: 45, lon: 125 });
  const adjusted = applySeasonalAdjustment(base, seasonalBlendAtDayOfYear(274));

  assert.equal(adjusted.biomeId, base.biomeId);
  assert.ok(adjusted.hueShift < base.hueShift);
  assert.ok(adjusted.treeHue < base.treeHue);
});
