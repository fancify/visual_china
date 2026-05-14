import assert from "node:assert/strict";
import test from "node:test";

import {
  clampCoastalTargetTier,
  isCoastalL0Chunk
} from "../src/game/terrain/coastalLod.ts";

const bounds = { west: 73, east: 135, south: 18, north: 54 };

test("coastal L0 chunk detection samples both land and ocean inside the chunk", () => {
  const sampler = {
    isLand(lon) {
      return lon < 120.5;
    }
  };

  assert.equal(isCoastalL0Chunk(47, 23, 1, bounds, sampler), true);
  assert.equal(isCoastalL0Chunk(46, 23, 1, bounds, sampler), false);
  assert.equal(isCoastalL0Chunk(48, 23, 1, bounds, sampler), false);
});

test("coastal chunks are clamped to L1 or finer instead of distant L2/L3", () => {
  const sampler = {
    isLand(lon) {
      return lon < 120.5;
    }
  };

  assert.equal(clampCoastalTargetTier(3, 47, 23, 1, bounds, sampler), 1);
  assert.equal(clampCoastalTargetTier(2, 47, 23, 1, bounds, sampler), 1);
  assert.equal(clampCoastalTargetTier(0, 47, 23, 1, bounds, sampler), 0);
  assert.equal(clampCoastalTargetTier(3, 46, 23, 1, bounds, sampler), 3);
});
