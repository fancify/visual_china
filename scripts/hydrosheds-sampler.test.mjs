import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import { getHydroShedsSampler } from "./hydrosheds-sampler.mjs";

const expectedSourceSuffix = path.join("data", "hydrosheds", "hyd_as_dem_15s.tif");

test("HydroSHEDS sampler uses the 15s Asia TIFF source only", async () => {
  const sampler = await getHydroShedsSampler();

  assert.ok(sampler.sourcePath.endsWith(expectedSourceSuffix));
});

test("HydroSHEDS sampler reads Wuhan as lowland terrain", async () => {
  const sampler = await getHydroShedsSampler();
  const meters = sampler.sample(114.3055, 30.5928);

  assert.ok(meters >= 0 && meters <= 300, `expected Wuhan lowland terrain, got ${meters}`);
});

test("HydroSHEDS sampler reads Taibai Shan as high relief", async () => {
  const sampler = await getHydroShedsSampler();
  const meters = sampler.sample(107.775, 33.959);

  assert.ok(meters >= 3000, `expected alpine relief, got ${meters}`);
});

test("HydroSHEDS sampler returns 0 outside the cached China window", async () => {
  const sampler = await getHydroShedsSampler();

  assert.equal(sampler.sample(60, 10), 0);
});

test("HydroSHEDS sampler can sample a regular overlap grid", async () => {
  const sampler = await getHydroShedsSampler();
  const grid = sampler.sampleGrid(
    { west: 106.8, east: 107.2, south: 33.8, north: 34.0 },
    8,
    6
  );

  assert.equal(grid.length, 48);
  assert.ok(grid.every((value) => Number.isFinite(value)));
});
