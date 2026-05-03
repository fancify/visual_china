import assert from "node:assert/strict";
import test from "node:test";

import { biomeWeightsAt } from "../src/game/biomeZones.ts";

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
