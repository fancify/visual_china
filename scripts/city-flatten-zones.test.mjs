import assert from "node:assert/strict";
import test from "node:test";

import { createChunkScenery } from "../src/game/scenery.ts";
import { qinlingRuntimeBudget } from "../src/game/performanceBudget.ts";
import { TerrainSampler } from "../src/game/demSampler.ts";
import {
  findZoneAt,
  flattenedY,
  setCityFlattenZones
} from "../src/game/cityFlattenZones.js";

function makeTinyAsset() {
  return {
    name: "test-dem",
    sourceType: "unit-test",
    generatedAt: "2026-05-04T00:00:00.000Z",
    world: { width: 10, depth: 10 },
    grid: { columns: 2, rows: 2 },
    minHeight: 0,
    maxHeight: 4,
    heights: [1, 2, 3, 4],
    riverMask: [0.2, 0.6, 0.8, 1],
    passMask: [0, 0, 0, 0],
    settlementMask: [0, 0, 0, 0]
  };
}

function makeFlatScenerySampler({
  normalizedHeight,
  slope = 0,
  river = 0,
  width = 36,
  depth = 36,
  worldBounds
}) {
  return {
    asset: {
      minHeight: 0,
      maxHeight: 1,
      world: { width, depth },
      grid: { columns: 2, rows: 2 },
      bounds: undefined,
      presentation: undefined,
      worldBounds
    },
    sampleHeight() {
      return normalizedHeight;
    },
    sampleSurfaceHeight() {
      return normalizedHeight;
    },
    sampleSlope() {
      return slope;
    },
    sampleRiver() {
      return river;
    }
  };
}

function sceneryLeafCount(group) {
  return group.children.reduce((sum, child) => {
    return child.userData?.role === "leaf" ? sum + (child.count ?? 0) : sum;
  }, 0);
}

test("findZoneAt returns the nearest zone when a point is inside multiple", () => {
  setCityFlattenZones([
    { cityId: "a", centerX: 0, centerZ: 0, radius: 5, groundY: 1.0 },
    { cityId: "b", centerX: 4, centerZ: 0, radius: 5, groundY: 2.0 }
  ]);

  assert.equal(findZoneAt(2, 0)?.cityId, "a");
});

test("flattenedY returns zone groundY inside zone and original height outside", () => {
  setCityFlattenZones([
    { cityId: "a", centerX: 0, centerZ: 0, radius: 3, groundY: 1.5 }
  ]);

  assert.equal(flattenedY(0.7, 1, 0), 1.5);
  assert.equal(flattenedY(0.7, 5, 0), 0.7);
});

test("setCityFlattenZones with an empty list clears all zones", () => {
  setCityFlattenZones([
    { cityId: "a", centerX: 0, centerZ: 0, radius: 3, groundY: 1.5 }
  ]);

  setCityFlattenZones([]);

  assert.equal(findZoneAt(0, 0), null);
});

test("terrain sampler height override flattens heights and hides rivers inside city zones", () => {
  const sampler = new TerrainSampler(makeTinyAsset());
  setCityFlattenZones([
    { cityId: "a", centerX: 0, centerZ: 0, radius: 3.5, groundY: 1.5 }
  ]);

  sampler.setHeightOverride((rawY, x, z) => flattenedY(rawY, x, z));

  assert.equal(sampler.sampleHeight(0, 0), 1.5);
  assert.equal(sampler.sampleSurfaceHeight(0, 0), 1.5);
  assert.equal(sampler.sampleRiver(0, 0), 0);
  assert.notEqual(sampler.sampleHeight(4.5, 4.5), 1.5);
});

test("chunk scenery skips tree instances inside city flatten zones", () => {
  const sampler = makeFlatScenerySampler({
    normalizedHeight: 0.36,
    slope: 0.08,
    river: 0.12,
    worldBounds: { minX: 120, maxX: 156, minZ: 40, maxZ: 76 }
  });

  setCityFlattenZones([]);
  const baseline = createChunkScenery(sampler, qinlingRuntimeBudget.scenery);
  const baselineTrees = sceneryLeafCount(baseline);

  setCityFlattenZones([
    { cityId: "city", centerX: 138, centerZ: 58, radius: 40, groundY: 0.36 }
  ]);
  const flattened = createChunkScenery(sampler, qinlingRuntimeBudget.scenery);
  const flattenedTrees = sceneryLeafCount(flattened);

  assert.ok(baselineTrees > 0, `baseline chunk should still grow trees, got ${baselineTrees}`);
  assert.equal(flattenedTrees, 0);
});
