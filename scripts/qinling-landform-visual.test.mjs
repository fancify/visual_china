import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { createChunkScenery } from "../src/game/scenery.ts";
import { qinlingRuntimeBudget } from "../src/game/performanceBudget.ts";
import { loadDemAssetWithChannels } from "./dem-asset-io.mjs";

// Phase 3 全国 0.9 km：channels 已经拆成 binary sidecar，必须用 helper reassemble。
const asset = await loadDemAssetWithChannels("public/data/qinling-slice-dem.json");
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

test("Qinling slice keeps lowland basins readable in visual scale", (t) => {
  if (asset.grid.columns !== 6225 || asset.grid.rows !== 4316) {
    return t.skip(
      `public/data/qinling-slice-dem.json still at ${asset.grid.columns}×${asset.grid.rows}; rerun pipeline before refreshing visual baselines`
    );
  }

  const guanzhong = sampleHeightAt(108.94, 34.34);
  const hanzhong = sampleHeightAt(107.03, 33.07);
  const chengduPlain = sampleHeightAt(104.07, 30.67);
  const qinlingRidge = sampleHeightAt(107.5, 33.7);
  const verticalRange = asset.maxHeight - asset.minHeight;
  const waterLevel = asset.presentation?.waterLevel;

  assert.equal(asset.sourceType, "processed-real-dem");
  // Phase 2 全中国扩张：bounds = (73-135, 18-53)，cos(35.5°)=0.8141 校正世界尺寸。
  assert.deepEqual(asset.bounds, {
    west: 73,
    east: 135,
    south: 18,
    north: 53
  });
  assert.deepEqual(asset.world, {
    width: 1711,
    depth: 1186
  });
  assert.deepEqual(asset.grid, {
    columns: 6225,
    rows: 4316
  });
  assert.ok(
    Number.isFinite(waterLevel),
    "asset.presentation.waterLevel must be explicit so lowlands are not accidentally rendered as sea"
  );
  // Phase 3 全国 0.9 km：basin 抽样比 1.8 km 时更贴近底部，老的 -1 容忍带过严。
  // 只需保证 waterLevel < min(basin samples) 即水面不淹陆地。
  assert.ok(
    waterLevel < Math.min(guanzhong, hanzhong, chengduPlain),
    `global water plane must sit below Guanzhong, Hanzhong, and Chengdu lowlands (got water=${waterLevel}, min basin=${Math.min(guanzhong, hanzhong, chengduPlain)})`
  );
  assert.ok(
    verticalRange <= 24,
    `visual height range should stay readable for third-person scale, got ${verticalRange}`
  );
  // Phase 2 全国扩张：normalize 范围被 Everest (8848m) 拉宽 → 关中-秦岭对比由
  // 4.5 单位降到 ~3.5（同样代表 ~25% 的 verticalRange 15.6）。仍是清晰山墙。
  assert.ok(
    qinlingRidge > guanzhong + 3,
    `Qinling ridge should still read as a wall above Guanzhong, got ridge=${qinlingRidge.toFixed(2)} guanzhong=${guanzhong.toFixed(2)}`
  );
  assert.ok(
    Math.max(guanzhong, hanzhong, chengduPlain) < asset.minHeight + verticalRange * 0.35,
    "Guanzhong, Hanzhong, and Chengdu should remain lowland/basin samples"
  );
});

test("Qinling real DEM notes declare HydroSHEDS as the sole DEM source", (t) => {
  if (asset.grid.columns !== 6225 || asset.grid.rows !== 4316) {
    return t.skip("DEM asset not rebuilt to HydroSHEDS 0.9 km grid yet");
  }

  assert.ok(
    asset.notes.some(
      (note) => note.includes("Built from HydroSHEDS 15s (~450 m) DEM, no fallback paths.")
    ),
    "Qinling DEM should explicitly declare the HydroSHEDS-only build path"
  );
});

test("Qinling L1 declares national touring resolution strategy", (t) => {
  if (asset.resolutionStrategy?.runtimeSampleSpacingKm?.eastWest !== 0.9) {
    return t.skip("DEM asset resolution strategy still reflects the pre-rebuild baseline");
  }

  const strategy = asset.resolutionStrategy;

  assert.equal(strategy?.experienceLayer, "L1-national-tour-local-pilot");
  assert.equal(strategy?.coordinatePolicy, "strict-geographic");
  // Phase 3 全国扩张：cell 切到 0.9 km，east-west 和 north-south 都 ≈ 0.9 km。
  assert.ok(
    strategy.runtimeSampleSpacingKm.eastWest >= 0.85 &&
      strategy.runtimeSampleSpacingKm.eastWest <= 0.95
  );
  assert.ok(
    strategy.runtimeSampleSpacingKm.northSouth >= 0.85 &&
      strategy.runtimeSampleSpacingKm.northSouth <= 0.95
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
    asset.notes.some((note) => note.includes("HydroSHEDS 15s (~450 m) DEM")),
    "asset notes should describe the HydroSHEDS-only build path"
  );
  assert.ok(
    asset.notes.some((note) => note.includes("450m HydroSHEDS source detail")),
    "asset notes should describe the HydroSHEDS detail-retention zones"
  );
});

test("Qinling region manifest exposes the same scale architecture", (t) => {
  if (regionManifest.chunkColumns !== 125 || regionManifest.chunkRows !== 87) {
    return t.skip("region manifest not rebuilt to 125×87 chunk grid yet");
  }

  assert.equal(
    regionManifest.scaleArchitecture?.currentLayer,
    asset.resolutionStrategy.experienceLayer
  );
  assert.equal(regionManifest.scaleArchitecture?.nationalTouringBaseMeters, 450);
  assert.equal(regionManifest.scaleArchitecture?.detailCorrectionMeters, 450);
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

  // Phase 2 全国扩张：normalize 锚点变成 0..8157m（含 Everest），把秦岭/巴山的
  // 局部抬升压缩到更低的归一化区间。Zitong 现在落在丘陵带 baseline，Jianmen
  // 抬升到山带 baseline，Taibai 顶峰仍然显著高于支脉。容忍带 ±0.25 不变。
  assert.ok(
    zitong >= -1.72 && zitong <= -1.22,
    `Zitong hill belt should sit in mid-hill band, got ${zitong.toFixed(3)}`
  );
  assert.ok(
    jianmen >= -0.43 && jianmen <= 0.07,
    `Jianmen Pass should lift above Zitong, got ${jianmen.toFixed(3)}`
  );
  assert.ok(
    hillRelief >= 1.0 && hillRelief <= 1.5,
    `Zitong-Jianmen hill relief should preserve readable contrast, got ${hillRelief.toFixed(3)}`
  );
  assert.ok(
    taibaiPeak >= 3.6 && taibaiPeak <= 4.2,
    `Taibai peak should remain a distinct alpine summit, got ${taibaiPeak.toFixed(3)}`
  );
});

test("Qinling river carving keeps a narrow water footprint with sharper gorge walls", () => {
  const gorge = riverGorgeStats();

  // Phase 2 全国扩张：grid 行列大幅增加 + 13 条河覆盖全国，被 carve 的 cell
  // 总数自然涨；此处只锁住当前 baseline ±10% 容忍带，防回归扩散。
  // Phase 3 全国 0.9 km grid (4× 多 cells) → river paint 总 cell 翻倍量级。
  assert.ok(
    gorge.strongWaterCells >= 18000 && gorge.strongWaterCells <= 26000,
    `strong-water core should stay within current baseline, got ${gorge.strongWaterCells} cells`
  );
  assert.ok(
    gorge.visibleWaterCells >= 18000 && gorge.visibleWaterCells <= 28000,
    `visible water corridor should stay within current baseline, got ${gorge.visibleWaterCells} cells above 0.1`
  );
  // Phase 3 河流改成 ribbon 渲染后，carving 大幅压低（depth 0.85→0.18），
  // bank rise 从 ~1 unit 降到 ~0.4 unit。河谷不再深沟，靠 ribbon 显水。
  assert.ok(
    gorge.bankRise90 >= 0.2 && gorge.bankRise90 <= 0.8,
    `gorge banks should remain readable, got p90 rise ${gorge.bankRise90.toFixed(3)}`
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
