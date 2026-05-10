import assert from "node:assert/strict";
import test from "node:test";

import { CompositeTerrainSampler, TerrainSampler } from "../src/game/demSampler.ts";

function makeAsset(id, height, worldBounds) {
  return {
    id,
    type: "terrain-chunk",
    version: 1,
    regionId: "test",
    lod: "L2",
    name: id,
    sourceType: "unit-test",
    generatedAt: "2026-05-10T00:00:00.000Z",
    world: { width: 10, depth: 10 },
    worldBounds,
    grid: { columns: 2, rows: 2 },
    minHeight: height,
    maxHeight: height,
    heights: [height, height, height, height],
    riverMask: [0, 0, 0, 0],
    passMask: [0, 0, 0, 0],
    settlementMask: [0, 0, 0, 0]
  };
}

test("CompositeTerrainSampler reuses the last chunk hit for nearby samples", () => {
  const base = new TerrainSampler(makeAsset("base", 1, undefined));
  const composite = new CompositeTerrainSampler(base);

  composite.registerChunk(
    "west",
    new TerrainSampler(makeAsset("west", 2, { minX: -10, maxX: 0, minZ: -5, maxZ: 5 })),
    { minX: -10, maxX: 0, minZ: -5, maxZ: 5 }
  );
  composite.registerChunk(
    "east",
    new TerrainSampler(makeAsset("east", 3, { minX: 0, maxX: 10, minZ: -5, maxZ: 5 })),
    { minX: 0, maxX: 10, minZ: -5, maxZ: 5 }
  );

  const chunkEntries = composite.chunkEntries;
  let scans = 0;
  const originalValues = chunkEntries.values.bind(chunkEntries);
  chunkEntries.values = function values() {
    scans += 1;
    return originalValues();
  };

  assert.equal(Math.abs(composite.sampleHeight(2, 0) - 3 * 1.07) < 1e-9, true);
  assert.equal(Math.abs(composite.sampleSurfaceHeight(3, 1) - 3 * 1.07) < 1e-9, true);
  assert.equal(scans, 1);
});

test("CompositeTerrainSampler keeps a boundary point on the cached chunk until it changes", () => {
  const base = new TerrainSampler(makeAsset("base", 1, undefined));
  const composite = new CompositeTerrainSampler(base);

  composite.registerChunk(
    "west",
    new TerrainSampler(makeAsset("west", 2, { minX: -10, maxX: 0, minZ: -5, maxZ: 5 })),
    { minX: -10, maxX: 0, minZ: -5, maxZ: 5 }
  );
  composite.registerChunk(
    "east",
    new TerrainSampler(makeAsset("east", 3, { minX: 0, maxX: 10, minZ: -5, maxZ: 5 })),
    { minX: 0, maxX: 10, minZ: -5, maxZ: 5 }
  );

  assert.equal(Math.abs(composite.sampleHeight(-0.1, 0) - 2 * 1.07) < 1e-9, true);
  assert.equal(Math.abs(composite.sampleHeight(0, 0) - 2 * 1.07) < 1e-9, true);
  assert.equal(Math.abs(composite.sampleHeight(0.1, 0) - 3 * 1.07) < 1e-9, true);
  assert.equal(Math.abs(composite.sampleHeight(0, 0) - 3 * 1.07) < 1e-9, true);
});
