import assert from "node:assert/strict";
import test from "node:test";

import { Mesh } from "three";

import { createPyramidChunkMesh } from "../src/game/terrain/pyramidMesh.ts";
import { refreshVertexColors } from "../src/game/terrain/pyramidMesh.ts";

function makeChunk() {
  return {
    tier: "L0",
    chunkX: 0,
    chunkZ: 0,
    cellsPerChunk: 4,
    ghostWidth: 0,
    bounds: { west: 120, east: 121, north: 31, south: 30 },
    heights: new Float32Array(16).fill(10)
  };
}

function makeFlatLowChunk(cellsPerChunk = 8) {
  return {
    tier: "L0",
    chunkX: 0,
    chunkZ: 0,
    cellsPerChunk,
    ghostWidth: 0,
    bounds: { west: 120, east: 121, north: 31, south: 30 },
    heights: new Float32Array(cellsPerChunk * cellsPerChunk).fill(1)
  };
}

function makeUniformHeightChunk(heightMeters, cellsPerChunk = 8) {
  return {
    tier: "L0",
    chunkX: 0,
    chunkZ: 0,
    cellsPerChunk,
    ghostWidth: 0,
    bounds: { west: 120, east: 121, north: 31, south: 30 },
    heights: new Float32Array(cellsPerChunk * cellsPerChunk).fill(heightMeters)
  };
}

test("pyramid mesh uses landMaskSampler to clip finite DEM cells at the coastline", () => {
  const noMask = createPyramidChunkMesh(makeChunk());
  const masked = createPyramidChunkMesh(makeChunk(), {
    landMaskSampler: {
      isLand(lon) {
        return lon < 120.5;
      }
    }
  });

  assert.ok(noMask.mesh instanceof Mesh);
  assert.ok(masked.mesh instanceof Mesh);
  assert.ok(noMask.geometry.index);
  assert.ok(masked.geometry.index);
  assert.ok(
    masked.geometry.index.count < noMask.geometry.index.count,
    "high-resolution land mask should remove ocean-side terrain triangles even when DEM is finite"
  );
});

test("flat low coastline vertices receive a narrow beach tint", () => {
  const masked = createPyramidChunkMesh(makeFlatLowChunk(), {
    landMaskSampler: {
      isLand(lon) {
        return lon < 120.72;
      }
    }
  });
  const untinted = createPyramidChunkMesh(makeFlatLowChunk(), {
    landMaskSampler: {
      isLand(lon) {
        return lon < 120.72;
      }
    },
    beachTintEnabled: false
  });
  const colors = masked.geometry.attributes.color;
  const baseColors = untinted.geometry.attributes.color;
  const coastalLandVertex = 5;

  assert.ok(
    colors.getX(coastalLandVertex) > baseColors.getX(coastalLandVertex),
    "flat near-shore land should shift subtly from green toward muted sand"
  );
  assert.ok(
    colors.getZ(coastalLandVertex) < colors.getY(coastalLandVertex),
    "flat near-shore land should stay earthy instead of becoming water-blue"
  );
});

test("inserted shoreline boundary vertices do not receive beach tint", () => {
  const masked = createPyramidChunkMesh(makeFlatLowChunk(), {
    landMaskSampler: {
      isLand(lon) {
        return lon < 120.72;
      }
    }
  });
  const baseVertexCount = masked.chunk.cellsPerChunk * masked.chunk.cellsPerChunk;
  const coastProximity = masked.geometry.userData.coastProximity;

  assert.ok(masked.geometry.attributes.position.count > baseVertexCount);
  for (let i = baseVertexCount; i < masked.geometry.attributes.position.count; i += 1) {
    assert.equal(
      coastProximity[i],
      0,
      "synthetic shoreline vertices define geometry only; beach tint must not thicken the edge"
    );
  }
});

test("steep coastline vertices do not become sand beaches", () => {
  const chunk = makeFlatLowChunk();
  chunk.heights[5] = 80;
  const masked = createPyramidChunkMesh(chunk, {
    landMaskSampler: {
      isLand(lon) {
        return lon < 120.72;
      }
    }
  });
  const colors = masked.geometry.attributes.color;
  const steepCoastalVertex = 5;

  assert.ok(
    colors.getX(steepCoastalVertex) < 0.55,
    "steep or elevated coast should stay rock/grass, not beach sand"
  );
});

test("beach tint can be disabled by clearing coast proximity and refreshing colors", () => {
  const masked = createPyramidChunkMesh(makeFlatLowChunk(), {
    landMaskSampler: {
      isLand(lon) {
        return lon < 120.72;
      }
    }
  });
  const colors = masked.geometry.attributes.color;
  const coastalLandVertex = 5;
  const tintedRed = colors.getX(coastalLandVertex);

  masked.geometry.userData.coastProximity.fill(0);
  refreshVertexColors(masked);

  assert.ok(
    colors.getX(coastalLandVertex) < tintedRed - 0.05,
    "clearing coast proximity should visibly remove beach tint"
  );
});

test("lowland terrain stays warmer and less water-blue than rivers", () => {
  const mesh = createPyramidChunkMesh(makeUniformHeightChunk(200));
  const colors = mesh.geometry.attributes.color;
  const center = 4 * 8 + 4;

  assert.ok(
    colors.getY(center) > colors.getX(center) + 0.12,
    "lowland terrain should read as saturated blue-green grass, not dry ochre"
  );
  assert.ok(
    colors.getX(center) > colors.getZ(center) + 0.08,
    "lowland terrain should still keep enough warm pigment to separate from blue water"
  );
});

test("foothill terrain mixes green with Chang'an warm ochre instead of going soil-yellow", () => {
  const mesh = createPyramidChunkMesh(makeUniformHeightChunk(1800));
  const colors = mesh.geometry.attributes.color;
  const center = 4 * 8 + 4;

  assert.ok(colors.getY(center) >= colors.getX(center) - 0.02, "foothills should keep visible green");
  assert.ok(colors.getZ(center) < colors.getY(center), "foothills should avoid blue water tones");
});

test("high mountains reach a visible snowline", () => {
  const mesh = createPyramidChunkMesh(makeUniformHeightChunk(4600));
  const colors = mesh.geometry.attributes.color;
  const center = 4 * 8 + 4;

  assert.ok(colors.getX(center) > 0.78, "snowline should brighten high mountain red channel");
  assert.ok(colors.getY(center) > 0.78, "snowline should brighten high mountain green channel");
  assert.ok(colors.getZ(center) > 0.74, "snowline should brighten high mountain blue channel");
});
