import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createChunkScenery } from "../src/game/scenery.ts";
import { qinlingRuntimeBudget } from "../src/game/performanceBudget.ts";

const asset = JSON.parse(
  fs.readFileSync("public/data/qinling-slice-dem.json", "utf8")
);
const terrainModelSource = fs.readFileSync("src/game/terrainModel.ts", "utf8");
const regionManifest = JSON.parse(
  fs.readFileSync("public/data/regions/qinling/manifest.json", "utf8")
);

function sceneryLeafCount(group) {
  return group.children.reduce((sum, child) => {
    return child.userData?.role === "leaf" ? sum + (child.count ?? 0) : sum;
  }, 0);
}

function sampleHeightAt(lon, lat) {
  const { bounds, grid, heights } = asset;
  const column = Math.round(
    ((lon - bounds.west) / (bounds.east - bounds.west)) * (grid.columns - 1)
  );
  const row = Math.round(
    ((bounds.north - lat) / (bounds.north - bounds.south)) * (grid.rows - 1)
  );

  return heights[row * grid.columns + column];
}

function localReliefStats() {
  const { grid, heights } = asset;
  const neighborJumps = [];
  const localSlopes = [];

  for (let row = 1; row < grid.rows - 1; row += 1) {
    for (let column = 1; column < grid.columns - 1; column += 1) {
      const index = row * grid.columns + column;
      const height = heights[index];
      const left = heights[row * grid.columns + column - 1];
      const right = heights[row * grid.columns + column + 1];
      const up = heights[(row - 1) * grid.columns + column];
      const down = heights[(row + 1) * grid.columns + column];

      neighborJumps.push(
        Math.abs(height - left),
        Math.abs(height - right),
        Math.abs(height - up),
        Math.abs(height - down)
      );
      localSlopes.push(Math.hypot(right - left, down - up));
    }
  }

  neighborJumps.sort((a, b) => a - b);
  localSlopes.sort((a, b) => a - b);

  return {
    jump95: neighborJumps[Math.floor(neighborJumps.length * 0.95)],
    slope95: localSlopes[Math.floor(localSlopes.length * 0.95)]
  };
}

function riverGorgeStats() {
  const { grid, heights, riverMask } = asset;
  const strongWaterCells = [];
  const bankRise = [];
  let visibleWaterCells = 0;

  for (let row = 1; row < grid.rows - 1; row += 1) {
    for (let column = 1; column < grid.columns - 1; column += 1) {
      const index = row * grid.columns + column;
      const river = riverMask[index];

      if (river > 0.1) {
        visibleWaterCells += 1;
      }

      if (river <= 0.85) {
        continue;
      }

      strongWaterCells.push(index);
      const center = heights[index];
      const neighbors = [
        heights[index - 1],
        heights[index + 1],
        heights[index - grid.columns],
        heights[index + grid.columns]
      ];
      bankRise.push(Math.max(...neighbors) - center);
    }
  }

  bankRise.sort((a, b) => a - b);

  return {
    visibleWaterCells,
    strongWaterCells: strongWaterCells.length,
    bankRise90: bankRise[Math.floor(bankRise.length * 0.9)] ?? 0,
    bankRiseMean:
      bankRise.reduce((total, value) => total + value, 0) / (bankRise.length || 1)
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

test("Qinling slice keeps lowland basins readable in visual scale", () => {
  const guanzhong = sampleHeightAt(108.94, 34.34);
  const hanzhong = sampleHeightAt(107.03, 33.07);
  const chengduPlain = sampleHeightAt(104.07, 30.67);
  const qinlingRidge = sampleHeightAt(107.5, 33.7);
  const verticalRange = asset.maxHeight - asset.minHeight;
  const waterLevel = asset.presentation?.waterLevel;

  assert.equal(asset.sourceType, "processed-real-dem");
  // 北扩到 40°N 后 baseline 更新：north 边界上移，但 grid 维度维持不变。
  assert.deepEqual(asset.bounds, {
    west: 103.5,
    east: 117,
    south: 22,
    north: 40
  });
  assert.deepEqual(asset.world, {
    width: 373,
    depth: 579
  });
  assert.deepEqual(asset.grid, {
    columns: 416,
    rows: 666
  });
  assert.ok(
    Number.isFinite(waterLevel),
    "asset.presentation.waterLevel must be explicit so lowlands are not accidentally rendered as sea"
  );
  assert.ok(
    waterLevel < Math.min(guanzhong, hanzhong, chengduPlain) - 1,
    "global water plane must sit below Guanzhong, Hanzhong, and Chengdu lowlands"
  );
  assert.ok(
    verticalRange <= 24,
    `visual height range should stay readable for third-person scale, got ${verticalRange}`
  );
  // 2026-05 高度调试历程: 22→11→16.5。阈值跟着 ×1.5 = 4.5
  // (仍要求 ridge 高出 关中 至少 ~30% 的总动态范围)
  assert.ok(
    qinlingRidge > guanzhong + 4.5,
    `Qinling ridge should still read as a wall above Guanzhong, got ridge=${qinlingRidge.toFixed(2)} guanzhong=${guanzhong.toFixed(2)}`
  );
  assert.ok(
    Math.max(guanzhong, hanzhong, chengduPlain) < asset.minHeight + verticalRange * 0.35,
    "Guanzhong, Hanzhong, and Chengdu should remain lowland/basin samples"
  );
});

test("Qinling real DEM uses all required FABDEM source tiles", () => {
  assert.ok(
    asset.notes.some(
      (note) =>
        (note.includes("Missing required tiles filled with 0") ||
          note.includes("Missing required FABDEM tiles fell back to ETOPO 60s")) &&
        note.includes("N28E110_FABDEM_V1-2.tif") &&
        note.includes("N29E110_FABDEM_V1-2.tif")
    ),
    "Qinling DEM should explicitly report the SE corner tile gap, whether it still reflects the old zero-fill asset or a rebuilt ETOPO fallback asset"
  );
});

test("Qinling L1 declares national touring resolution strategy", () => {
  const strategy = asset.resolutionStrategy;

  assert.equal(strategy?.experienceLayer, "L1-national-tour-local-pilot");
  assert.equal(strategy?.baseTerrainResolutionMeters, 90);
  assert.equal(strategy?.detailCorrectionResolutionMeters, 30);
  assert.equal(strategy?.sparseRegionResolutionMeters, 450);
  assert.equal(strategy?.coordinatePolicy, "strict-geographic");
  assert.ok(
    strategy.runtimeSampleSpacingKm.eastWest >= 0.99 &&
      strategy.runtimeSampleSpacingKm.eastWest <= 1.19
  );
  // grid 翻倍后维持同一地理覆盖范围，north-south 采样间距约减半到 ~2.26 km。
  assert.ok(
    strategy.runtimeSampleSpacingKm.northSouth >= 2.11 &&
      strategy.runtimeSampleSpacingKm.northSouth <= 2.41
  );
  assert.deepEqual(
    strategy.detailCorrectionZones.map((zone) => zone.id),
    [
      "guanzhong-plain",
      "hanzhong-basin",
      "northern-sichuan-basin",
      "qinling-shu-road-corridors"
    ]
  );
  assert.ok(
    asset.notes.some((note) => note.includes("90m touring terrain base")),
    "asset notes should describe the 90m L1 base"
  );
  assert.ok(
    asset.notes.some((note) => note.includes("30m correction zones")),
    "asset notes should describe the 30m correction zones"
  );
});

test("Qinling region manifest exposes the same scale architecture", () => {
  assert.equal(
    regionManifest.scaleArchitecture?.currentLayer,
    asset.resolutionStrategy.experienceLayer
  );
  assert.equal(regionManifest.scaleArchitecture?.nationalTouringBaseMeters, 90);
  assert.equal(regionManifest.scaleArchitecture?.detailCorrectionMeters, 30);
  assert.equal(regionManifest.scaleArchitecture?.sparseRegionMeters, 450);
  assert.deepEqual(
    regionManifest.scaleArchitecture?.runtimeSampleSpacingKm,
    asset.resolutionStrategy.runtimeSampleSpacingKm
  );
});

test("Qinling visual relief avoids needle-like mountain noise", () => {
  const relief = localReliefStats();

  assert.ok(
    relief.jump95 <= 2,
    `95th percentile neighbor height jump should stay readable, got ${relief.jump95}`
  );
  assert.ok(
    relief.slope95 <= 3.4,
    `95th percentile local slope should avoid needle-like ridges, got ${relief.slope95}`
  );
});

test("mid-range elevation enhancement lifts hill terrain without inflating peaks", () => {
  const zitong = sampleHeightAt(105.16, 31.64);
  const jianmen = sampleHeightAt(105.55, 32.2);
  const taibaiPeak = sampleHeightAt(107.77, 33.95);
  const hillRelief = jianmen - zitong;

  assert.ok(
    zitong >= -0.78 && zitong <= -0.28,
    `Zitong hill belt should lift into a clearly higher mid-hill band, got ${zitong.toFixed(3)}`
  );
  assert.ok(
    // 南扩到 lat 22 后 baseline 更新：中段丘陵抬升值回落，但保留同样 ±0.25 容忍带。
    jianmen >= 0.94 && jianmen <= 1.44,
    `Jianmen Pass should lift into a distinctly raised hill relief band, got ${jianmen.toFixed(3)}`
  );
  assert.ok(
    hillRelief >= 1.55 && hillRelief <= 2.05,
    `Zitong-Jianmen hill relief should expand well beyond the prior ~1.2 unit contrast, got ${hillRelief.toFixed(3)}`
  );
  assert.ok(
    taibaiPeak >= 6.99 && taibaiPeak <= 7.39,
    `Taibai peak should remain near its prior silhouette, got ${taibaiPeak.toFixed(3)}`
  );
});

test("Qinling river carving keeps a narrow water footprint with sharper gorge walls", () => {
  const gorge = riverGorgeStats();

  // 2026-05 北扩到 40°N 后，同一 river paint 投到更粗的南北 cell，core / visible 基线回落到 ~4.0k cells；
  // 这里仅同步当前 checked-in 资产的中心值，容忍带保持不变。
  assert.ok(
    gorge.strongWaterCells >= 3821 && gorge.strongWaterCells <= 4121,
    `segment-walk river paint should expand the strong-water core without exploding width, got ${gorge.strongWaterCells} cells`
  );
  assert.ok(
    gorge.visibleWaterCells >= 3771 && gorge.visibleWaterCells <= 4171,
    `segment-walk river paint should keep the visible river corridor narrow after the radius cut, got ${gorge.visibleWaterCells} cells above 0.1`
  );
  assert.ok(
    gorge.bankRise90 >= 1.028 && gorge.bankRise90 <= 1.128,
    `continuous river carving should keep gorge banks pronounced, got p90 rise ${gorge.bankRise90.toFixed(3)}`
  );
});

test("terrain river tint thresholds stay narrowed for crisp water edges", () => {
  assert.match(
    terrainModelSource,
    /if\s*\(river\s*>\s*0\.85\)/,
    "terrain water tint should only kick in on the strongest river mask core"
  );
  assert.match(
    terrainModelSource,
    /\(river\s*-\s*0\.85\)\s*\/\s*0\.15/,
    "terrain water tint ramp should compress into the 0.85-1.0 mask band"
  );
  assert.match(
    terrainModelSource,
    /river\s*\*\s*0\.20/,
    "riparian tint should stay weaker so river banks do not look mushy"
  );
});

test("chunk scenery now allows sparse basin trees without exceeding the tree cap", () => {
  const basinSampler = makeFlatScenerySampler({
    normalizedHeight: 0.1,
    slope: 0.04,
    river: 0.02,
    worldBounds: { minX: 120, maxX: 156, minZ: 40, maxZ: 76 }
  });
  const mountainSampler = makeFlatScenerySampler({
    normalizedHeight: 0.36,
    slope: 0.08,
    river: 0.12,
    worldBounds: { minX: 120, maxX: 156, minZ: 80, maxZ: 116 }
  });
  const basinScenery = createChunkScenery(
    basinSampler,
    qinlingRuntimeBudget.scenery
  );
  const mountainScenery = createChunkScenery(
    mountainSampler,
    qinlingRuntimeBudget.scenery
  );
  const basinTrees = sceneryLeafCount(basinScenery);
  const mountainTrees = sceneryLeafCount(mountainScenery);

  assert.ok(
    basinTrees > 0,
    `Sichuan-style basin chunk should no longer be locked to 0 trees, got ${basinTrees}`
  );
  assert.ok(
    basinTrees < mountainTrees,
    `basin chunk should stay sparser than mountain chunk, got basin=${basinTrees} mountain=${mountainTrees}`
  );
  assert.ok(
    mountainTrees <= qinlingRuntimeBudget.scenery.maxTreesPerChunk,
    `mountain chunk must still respect maxTreesPerChunk=${qinlingRuntimeBudget.scenery.maxTreesPerChunk}, got ${mountainTrees}`
  );
});
