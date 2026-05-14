import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  l0ChunkWindowForCamera,
  clampCoastalTargetTier,
  isCoastalL0Chunk
} from "../src/game/terrain/coastalLod.ts";
import { projectGeoToWorld } from "../src/game/mapOrientation.js";
import {
  qinlingRegionBounds,
  qinlingRegionWorld
} from "../src/data/qinlingRegion.js";

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

test("coastal chunks keep their distance tier because all tiers use vector land clipping", () => {
  const sampler = {
    isLand(lon) {
      return lon < 120.5;
    }
  };

  assert.equal(clampCoastalTargetTier(3, 47, 23, 1, bounds, sampler), 3);
  assert.equal(clampCoastalTargetTier(2, 47, 23, 1, bounds, sampler), 2);
  assert.equal(clampCoastalTargetTier(0, 47, 23, 1, bounds, sampler), 0);
  assert.equal(clampCoastalTargetTier(3, 46, 23, 1, bounds, sampler), 3);
});

test("terrain visibility uses view radius to restrict the L0 chunk scan window", () => {
  const beijing = projectGeoToWorld(
    { lat: 39.9042, lon: 116.4074 },
    qinlingRegionBounds,
    qinlingRegionWorld
  );
  const fullRange = { xMin: 0, xMax: 61, zMin: 0, zMax: 35 };
  const window = l0ChunkWindowForCamera(
    beijing.x,
    beijing.z,
    80,
    1,
    qinlingRegionBounds,
    fullRange
  );

  assert.ok(window.xMin > fullRange.xMin);
  assert.ok(window.xMax < fullRange.xMax);
  assert.ok(window.zMin > fullRange.zMin);
  assert.ok(window.zMax < fullRange.zMax);
  assert.ok(
    (window.xMax - window.xMin + 1) * (window.zMax - window.zMin + 1) <
      (fullRange.xMax - fullRange.xMin + 1) * (fullRange.zMax - fullRange.zMin + 1) / 8
  );
});

test("terrain visibility requests the complete desired set without flooding high-detail L0", () => {
  const source = fs.readFileSync(
    new URL("../src/game/terrain/pyramidBootstrap.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /const lodBands: \[number, number, number\] = \[120, 220, 300\]/);
  assert.match(source, /updateVisibleAsync\(camera: PerspectiveCamera, scene: Scene\): Promise<void>/);
  assert.match(source, /await Promise\.all\(requestKeys\.map/);
  assert.match(source, /function footprintsOverlap/);
  assert.match(source, /function addExistingChildChunks/);
  assert.match(source, /split the parent into child chunks/);
  assert.match(source, /desiredKeys\.delete\(coarseKey\)/);
  assert.match(source, /nationwide horizon\/backdrop layer/);
  assert.match(source, /manifest\.tiers\.L3\.chunks/);
  assert.match(source, /landMaskSampler: opts\.landMaskSampler/);
  assert.match(source, /prevents far coarse chunks\s*\n\s*\/\/ from drawing giant rectangular land slabs across ocean/);
  assert.match(source, /clipInvalidHeights: false/);
  assert.match(source, /requestKeys = Array\.from\(desiredKeys\)\.sort/);
  assert.doesNotMatch(source, /requestBudget/);
  assert.doesNotMatch(source, /pendingMeshKeys/);
  assert.match(source, /if \(!latestDesiredKeys\.has\(k\)\) return/);
});
