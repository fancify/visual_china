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

test("Guanzhong north sample keeps the warm-temperate humid preset", () => {
  const biome = biomeWeightsAt({ lat: 34.7, lon: 108 });

  assert.equal(biome.biomeId, "warm-temperate-humid");
  assertClose(biome.hueShift, -0.012);
  assertClose(biome.satScale, 0.92);
  assertClose(biome.lumScale, 1.02);
  assertClose(biome.vegetationDensity, 0.85);
  assertClose(biome.treeHue, 0.24);
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
  const biome = biomeWeightsAt({ lat: 27.0, lon: 111.0 });

  assert.equal(biome.biomeId, "subtropical-humid");
  assertClose(biome.hueShift, 0.06);
  assertClose(biome.satScale, 1.3);
  assertClose(biome.lumScale, 0.92);
  assertClose(biome.vegetationDensity, 1.45);
  assertClose(biome.treeHue, 0.33);
});

test("Wuhan sample promotes the Jianghan plain biome", () => {
  const biome = biomeWeightsAt({ lat: 30.59, lon: 114.31 });

  assert.equal(biome.biomeId, "jianghan-plain");
  assert.ok(biome.hueShift > 0.06);
  assert.ok(biome.vegetationDensity > 1.2);
});

test("Guiyang sample promotes the Yungui plateau biome", () => {
  const biome = biomeWeightsAt({ lat: 26.6, lon: 106.5 });

  assert.equal(biome.biomeId, "yungui-plateau");
});

test("Guilin sample promotes the karst mountains biome", () => {
  const biome = biomeWeightsAt({ lat: 25.27, lon: 110.29 });

  assert.equal(biome.biomeId, "karst-mountains");
});

test("Xi'an sample stays in the warm-temperate humid biome", () => {
  const biome = biomeWeightsAt({ lat: 34.27, lon: 108.9 });

  assert.equal(biome.biomeId, "warm-temperate-humid");
});

test("Chengdu sample uses the stronger subtropical humid palette inside the Qinling slice", () => {
  const biome = biomeWeightsAt({ lat: 30.66, lon: 104.07 });

  assert.equal(biome.biomeId, "subtropical-humid");
  assertClose(biome.hueShift, 0.06);
  assertClose(biome.satScale, 1.3);
  assertClose(biome.lumScale, 0.92);
  assertClose(biome.vegetationDensity, 1.45);
  assertClose(biome.treeHue, 0.33);
});

test("nationwide sample maps Hainan to tropical humid", () => {
  const biome = biomeWeightsAt({ lat: 18, lon: 109 });

  assert.equal(biome.biomeId, "tropical-humid");
  assertClose(biome.hueShift, 0.045);
  assertClose(biome.satScale, 1.25);
  assertClose(biome.lumScale, 0.95);
});

test("nationwide sample maps the broader North China plain to the dedicated plain zone", () => {
  const biome = biomeWeightsAt({ lat: 35, lon: 116 });

  assert.equal(biome.biomeId, "north-china-plain");
  assert.ok(biome.hueShift > -0.012);
  assert.ok(biome.hueShift < 0);
  assert.ok(biome.satScale > 0.92);
  assert.ok(biome.satScale < 1.0);
  assert.ok(biome.lumScale > 1.02);
  assert.ok(biome.lumScale < 1.05);
});

test("Loess Plateau sample promotes the dedicated loess biome zone", () => {
  const biome = biomeWeightsAt({ lat: 37.0, lon: 109.0 });

  assert.equal(biome.biomeId, "loess-plateau");
});

test("North China Plain core sample promotes the dedicated plain biome zone", () => {
  const biome = biomeWeightsAt({ lat: 37.0, lon: 114.0 });

  assert.equal(biome.biomeId, "north-china-plain");
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

test("nationwide boundary at 40N 110E now leans into the loess/steppe transition", () => {
  const boundary = biomeWeightsAt({ lat: 40, lon: 110 });

  assert.equal(boundary.biomeId, "loess-plateau");
  assert.ok(boundary.hueShift < -0.03);
  assert.ok(boundary.hueShift > -0.05);
  assert.ok(boundary.satScale < 0.8);
  assert.ok(boundary.satScale > 0.7);
  assert.ok(boundary.lumScale > 1.07);
  assert.ok(boundary.lumScale < 1.1);
  assert.ok(boundary.vegetationDensity > 0.6);
});
