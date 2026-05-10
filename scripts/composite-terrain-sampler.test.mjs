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

function makeLodAsset() {
  return {
    id: "lod",
    type: "terrain-chunk",
    version: 2,
    schemaVersion: 2,
    regionId: "test",
    lod: "L2",
    name: "lod",
    sourceType: "unit-test",
    generatedAt: "2026-05-10T00:00:00.000Z",
    world: { width: 10, depth: 10 },
    grid: { columns: 4, rows: 4 },
    minHeight: 0,
    maxHeight: 15,
    heights: [
      0, 1, 2, 3,
      4, 5, 6, 7,
      8, 9, 10, 11,
      12, 13, 14, 15
    ],
    lodHeights: {
      L1: {
        grid: { columns: 2, rows: 2 },
        heights: [2.5, 4.5, 10.5, 12.5]
      }
    },
    riverMask: new Array(16).fill(0),
    passMask: new Array(16).fill(0),
    settlementMask: new Array(16).fill(0)
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

test("TerrainSampler.sampleHeightLod bilinearly samples downsampled LOD grids", () => {
  const sampler = new TerrainSampler(makeLodAsset());

  assert.equal(Math.abs(sampler.sampleHeightLod(-5, -5, 1) - 2.5 * 1.07) < 1e-9, true);
  assert.equal(Math.abs(sampler.sampleHeightLod(5, 5, 1) - 12.5 * 1.07) < 1e-9, true);
  assert.equal(Math.abs(sampler.sampleHeightLod(0, 0, 1) - 7.5 * 1.07) < 1e-9, true);
});

test("TerrainSampler.sampleHeightLod falls back to L0 when lodHeights are absent", () => {
  const sampler = new TerrainSampler(makeAsset("v1", 3, undefined));

  assert.equal(sampler.sampleHeightLod(0, 0, 2), sampler.sampleHeight(0, 0));
});

test("CompositeTerrainSampler.sampleHeightLod uses chunk LOD before base fallback", () => {
  const base = new TerrainSampler(makeAsset("base", 1, undefined));
  const composite = new CompositeTerrainSampler(base);

  composite.registerChunk(
    "lod",
    new TerrainSampler({
      ...makeLodAsset(),
      worldBounds: { minX: -5, maxX: 5, minZ: -5, maxZ: 5 }
    }),
    { minX: -5, maxX: 5, minZ: -5, maxZ: 5 }
  );

  assert.equal(Math.abs(composite.sampleHeightLod(0, 0, 1) - 7.5 * 1.07) < 1e-9, true);
  assert.equal(Math.abs(composite.sampleHeightLod(20, 0, 1) - 1 * 1.07) < 1e-9, true);
});
