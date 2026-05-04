import assert from "node:assert/strict";
import test from "node:test";

import { biomeWeightsAt } from "../src/game/biomeZones.ts";

function assertClose(actual, expected, epsilon = 1e-6) {
  assert.ok(
    Math.abs(actual - expected) <= epsilon,
    `expected ${actual} to be within ${epsilon} of ${expected}`
  );
}

test("Qinling south samples as subtropical humid biome", () => {
  const biome = biomeWeightsAt({ lat: 32, lon: 107 });

  assert.equal(biome.biomeId, "subtropical-humid");
  assert.ok(biome.vegetationDensity > 1.2);
});

test("Guanzhong north samples as warm-temperate humid biome", () => {
  const biome = biomeWeightsAt({ lat: 34, lon: 108 });

  assert.equal(biome.biomeId, "warm-temperate-humid");
  assert.ok(biome.vegetationDensity < 1.0);
});

test("Qinling ridge transition blends south and north weights smoothly", () => {
  const south = biomeWeightsAt({ lat: 32, lon: 107 });
  const north = biomeWeightsAt({ lat: 34, lon: 108 });
  const ridge = biomeWeightsAt({ lat: 33.5, lon: 108 });

  assert.ok(ridge.hueShift < south.hueShift);
  assert.ok(ridge.hueShift > north.hueShift);
  assert.ok(ridge.vegetationDensity < south.vegetationDensity);
  assert.ok(ridge.vegetationDensity > north.vegetationDensity);
});

test("vegetation density descends from humid south to semiarid north edge", () => {
  const subtropical = biomeWeightsAt({ lat: 32, lon: 107 });
  const humid = biomeWeightsAt({ lat: 34, lon: 108 });
  const semiarid = biomeWeightsAt({ lat: 35.6, lon: 107.5 });

  assert.ok(subtropical.vegetationDensity > humid.vegetationDensity);
  assert.ok(humid.vegetationDensity > semiarid.vegetationDensity);
});

test("nationwide sample maps Yangtze southland to subtropical humid", () => {
  const biome = biomeWeightsAt({ lat: 25, lon: 110 });

  assert.equal(biome.biomeId, "subtropical-humid");
  assertClose(biome.hueShift, 0.028);
  assertClose(biome.satScale, 1.16);
  assertClose(biome.lumScale, 0.96);
});

test("nationwide sample maps Hainan to tropical humid", () => {
  const biome = biomeWeightsAt({ lat: 18, lon: 109 });

  assert.equal(biome.biomeId, "tropical-humid");
  assertClose(biome.hueShift, 0.045);
  assertClose(biome.satScale, 1.25);
  assertClose(biome.lumScale, 0.95);
});

test("nationwide sample maps North China plain to warm-temperate humid", () => {
  const biome = biomeWeightsAt({ lat: 35, lon: 116 });

  assert.equal(biome.biomeId, "warm-temperate-humid");
  assertClose(biome.hueShift, -0.012);
  assertClose(biome.satScale, 0.92);
  assertClose(biome.lumScale, 1.02);
});

test("nationwide sample maps northeast forests to cold humid", () => {
  const biome = biomeWeightsAt({ lat: 45, lon: 125 });

  assert.equal(biome.biomeId, "northeast-cold-humid");
  assertClose(biome.hueShift, 0.012);
  assertClose(biome.satScale, 1.05);
  assertClose(biome.lumScale, 0.85);
});

test("nationwide sample maps Inner Mongolia belt to temperate grassland", () => {
  const biome = biomeWeightsAt({ lat: 42, lon: 110 });

  assert.equal(biome.biomeId, "temperate-grassland");
  assertClose(biome.hueShift, -0.03);
  assertClose(biome.satScale, 0.7);
  assertClose(biome.lumScale, 1.1);
});

test("nationwide sample maps Tarim side to arid desert", () => {
  const biome = biomeWeightsAt({ lat: 39, lon: 88 });

  assert.equal(biome.biomeId, "arid-desert");
  assertClose(biome.hueShift, -0.06);
  assertClose(biome.satScale, 0.5);
  assertClose(biome.lumScale, 1.2);
});

test("nationwide sample maps Tibetan plateau to alpine meadow", () => {
  const biome = biomeWeightsAt({ lat: 32, lon: 90 });

  assert.equal(biome.biomeId, "alpine-meadow");
  assertClose(biome.hueShift, -0.01);
  assertClose(biome.satScale, 0.65);
  assertClose(biome.lumScale, 1.15);
});

test("nationwide boundary at 40N 110E soft-blends warm humid and grassland", () => {
  const boundary = biomeWeightsAt({ lat: 40, lon: 110 });

  assert.notEqual(boundary.biomeId, "warm-temperate-semiarid");
  assert.ok(boundary.hueShift < -0.012);
  assert.ok(boundary.hueShift > -0.03);
  assert.ok(boundary.satScale < 0.92);
  assert.ok(boundary.satScale > 0.7);
  assert.ok(boundary.lumScale > 1.02);
  assert.ok(boundary.lumScale < 1.1);
  assert.ok(boundary.vegetationDensity > 0.6);
});
