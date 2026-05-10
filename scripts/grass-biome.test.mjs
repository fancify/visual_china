import assert from "node:assert/strict";
import test from "node:test";

import {
  GRASS_DENSITY_MULTIPLIER,
  grassDensityAt
} from "../src/game/grassBiome.js";

test("grass density excludes high snow line", () => {
  assert.equal(grassDensityAt(0, 0, 2.51, 34, 108), "none");
  assert.equal(GRASS_DENSITY_MULTIPLIER.none, 0);
});

test("grass density keeps northwest desert and plateau sparse", () => {
  assert.equal(grassDensityAt(0, 0, 0.4, 39, 88), "sparse");
  assert.equal(grassDensityAt(0, 0, 1.2, 31, 92), "sparse");
  assert.equal(GRASS_DENSITY_MULTIPLIER.sparse, 0.2);
});

test("grass density makes south/east humid lowlands lush and defaults plains to normal", () => {
  assert.equal(grassDensityAt(0, 0, 0.3, 29, 113), "lush");
  assert.equal(grassDensityAt(0, 0, 0.3, 34, 108), "normal");
  assert.equal(GRASS_DENSITY_MULTIPLIER.normal, 1);
  assert.equal(GRASS_DENSITY_MULTIPLIER.lush, 1.4);
});
