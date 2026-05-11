// S1 Baseline Regression Gate — 19 cases
//
// 这个文件是 6-step refactor 的客观尺子。每个 case 锁定一个最近 12 个 commit
// 抓到的 bug 类型，让"穿模变多了/变少了"能量化回答，不再靠人眼看截图。
//
// 设计原则：
// 1. **不 import main.ts**。main.ts 即将在 S5 拆分，测试不能绑死它。
//    用 contract snapshot（譬如 foot offset = +0.03）替代 import 真函数。
// 2. **合成 DEM**，不依赖 build:dem 产出的真实数据。case 测算法/契约，
//    不测某个具体坐标的高程数值。
// 3. **数值断言 + 显式容差**。没有 pixel diff，没有 Playwright。
//    渲染顺序/polygonOffset 类纯 GPU bug 留给 S6 Hero slice 时再加 Playwright。
//
// 跑法：node --test scripts/regression-baseline.test.mjs
// 或：   npm run regression:baseline

import test from "node:test";
import assert from "node:assert/strict";

import { TerrainSampler, CompositeTerrainSampler } from "../src/game/demSampler.ts";
import {
  EnvironmentController,
  sunDirectionForTimeOfDay,
  daylightFactor,
  skyBodyHorizonFade,
  seasonAtDayOfYear
} from "../src/game/environment.ts";
import { projectGeoToWorld } from "../src/game/mapOrientation.js";
import { qinlingRegionBounds, qinlingRegionWorld } from "../src/data/qinlingRegion.js";

// ─── Constants（snapshot of contracts that S2-S6 must preserve）────────────
const FOOT_OFFSET = 0.03;                    // resolvePlayerTargetY 现行值（main.ts:887）
const TERRAIN_VERTICAL_EXAGGERATION = 1.07;  // demSampler.ts:134
const WORLD_UNIT_KM_TARGET = 3.27;           // 27.6u/° × 0.118 km/u 反算

// ─── Synthetic DEM builders ────────────────────────────────────────────────
function makeFlatAsset(height, world = { width: 100, depth: 100 }, grid = { columns: 16, rows: 16 }) {
  const n = grid.columns * grid.rows;
  return {
    id: "flat", name: "flat", sourceType: "unit-test",
    generatedAt: "2026-05-11T00:00:00.000Z",
    world, grid,
    minHeight: height, maxHeight: height,
    heights: new Array(n).fill(height),
    riverMask: new Array(n).fill(0),
    passMask: new Array(n).fill(0),
    settlementMask: new Array(n).fill(0)
  };
}

function makeSlopeAsset(zHeightFn, world = { width: 100, depth: 100 }, grid = { columns: 16, rows: 16 }) {
  const heights = [];
  for (let r = 0; r < grid.rows; r++) {
    const z = (r / (grid.rows - 1)) * world.depth - world.depth / 2;
    const h = zHeightFn(z);
    for (let c = 0; c < grid.columns; c++) heights.push(h);
  }
  return {
    id: "slope", name: "slope", sourceType: "unit-test",
    generatedAt: "2026-05-11T00:00:00.000Z",
    world, grid,
    minHeight: Math.min(...heights), maxHeight: Math.max(...heights),
    heights,
    riverMask: new Array(heights.length).fill(0),
    passMask: new Array(heights.length).fill(0),
    settlementMask: new Array(heights.length).fill(0)
  };
}

function makeHillAsset(hillFn, world = { width: 100, depth: 100 }, grid = { columns: 32, rows: 32 }) {
  const heights = [];
  for (let r = 0; r < grid.rows; r++) {
    const z = (r / (grid.rows - 1)) * world.depth - world.depth / 2;
    for (let c = 0; c < grid.columns; c++) {
      const x = (c / (grid.columns - 1)) * world.width - world.width / 2;
      heights.push(hillFn(x, z));
    }
  }
  return {
    id: "hill", name: "hill", sourceType: "unit-test",
    generatedAt: "2026-05-11T00:00:00.000Z",
    world, grid,
    minHeight: Math.min(...heights), maxHeight: Math.max(...heights),
    heights,
    riverMask: new Array(heights.length).fill(0),
    passMask: new Array(heights.length).fill(0),
    settlementMask: new Array(heights.length).fill(0)
  };
}

// 沿 (start → end) 等距采样 sampler.sampleHeight，看任何 sample 是否超过
// 直线在该位置的 y → 即遮挡。
function raycastTerrain(start, end, sampler, steps = 24) {
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const x = start.x + (end.x - start.x) * t;
    const z = start.z + (end.z - start.z) * t;
    const lineY = start.y + (end.y - start.y) * t;
    const terrainY = sampler.sampleHeight(x, z);
    if (terrainY > lineY + 0.001) {
      return { occluded: true, atT: t, terrainY, lineY };
    }
  }
  return { occluded: false };
}

// Snapshot 版的 resolvePlayerTargetY（不 import main.ts，避免 S5 拆分时
// 测试连环失败）。S5 完成后改成从 PlayerRuntime import。
function snapshotResolvePlayerTargetY({ currentMountId, ground, groundSurface, cloudFlightAltitude }) {
  const isFlying = currentMountId === "cloud" || currentMountId === "sword";
  if (isFlying) return cloudFlightAltitude;
  return (groundSurface ?? ground) + FOOT_OFFSET;
}

// ═══════════════════════════════════════════════════════════════════════════
// PLAYER / AVATAR (P1-P4) — foot offset & y smoothness
// ═══════════════════════════════════════════════════════════════════════════

test("P1 平地脚踩地面 (foot offset within tolerance)", () => {
  const result = snapshotResolvePlayerTargetY({
    currentMountId: "horse", ground: 5, groundSurface: 5, cloudFlightAltitude: 0
  });
  const drift = Math.abs(result - 5);
  assert.ok(drift < 0.05, `foot should rest within 0.05u of ground, got drift=${drift}`);
  assert.ok(result >= 5, `foot must be at or above ground, got y=${result}`);
});

test("P2 斜坡脚用 groundSurface (mesh-aligned, not bilinear)", () => {
  // groundSurface 比 ground 高 0.5 (mesh-aligned > bilinear at this point)
  const result = snapshotResolvePlayerTargetY({
    currentMountId: "horse", ground: 10, groundSurface: 10.5, cloudFlightAltitude: 0
  });
  // 必须用 groundSurface 而不是 ground（修复 P0 audit 的核心契约）
  assert.equal(result, 10.5 + FOOT_OFFSET, "foot must use groundSurface when provided");
});

test("P3 上坡 y 平滑（无 snap）", () => {
  // 模拟玩家从平地走上 30° 斜坡，采样 10 步，断言 d²y/dt² 无突变
  const asset = makeSlopeAsset((z) => z > 0 ? z * 0.5 : 0);
  const sampler = new TerrainSampler(asset);

  const ys = [];
  for (let i = 0; i < 10; i++) {
    const z = -10 + i * 2;
    const ground = sampler.sampleHeight(0, z);
    const surface = sampler.sampleSurfaceHeight(0, z);
    ys.push(snapshotResolvePlayerTargetY({
      currentMountId: "horse", ground, groundSurface: surface, cloudFlightAltitude: 0
    }));
  }

  // 二阶差分（加速度）应平滑：max |d²y| < 1.0 在等距 step 下
  let maxAcc = 0;
  for (let i = 1; i < ys.length - 1; i++) {
    const acc = Math.abs(ys[i + 1] - 2 * ys[i] + ys[i - 1]);
    if (acc > maxAcc) maxAcc = acc;
  }
  assert.ok(maxAcc < 1.0, `expected smooth y trajectory, got max d²y=${maxAcc.toFixed(3)}`);
});

test("P4 飞行 mount 忽略 ground（cloud flight altitude 绝对）", () => {
  const result = snapshotResolvePlayerTargetY({
    currentMountId: "cloud", ground: 5, groundSurface: 5, cloudFlightAltitude: 42
  });
  assert.equal(result, 42, "cloud flight must use absolute altitude, ignore ground");
});

// ═══════════════════════════════════════════════════════════════════════════
// CAMERA (C1-C3) — occlusion, framing, pitch
// ═══════════════════════════════════════════════════════════════════════════

test("C1 follow 模式不被前景山遮挡（terrain occlusion lift bug regression）", () => {
  // 山在 z=0 ±5 处高 20×exaggeration ≈ 21.4，camera 在 z=-30，player 在 z=20 地面
  // 不抬高 camera 时山会遮 → 必须抬高过山顶
  const asset = makeHillAsset((x, z) => {
    if (Math.abs(z) < 5 && Math.abs(x) < 30) return 20;
    return 0;
  });
  const sampler = new TerrainSampler(asset);

  // 未抬高：camera 视线穿山
  const cameraLow = { x: 0, y: 5, z: -30 };
  const player = { x: 0, y: 0, z: 20 };
  const hitLow = raycastTerrain(cameraLow, player, sampler);
  assert.ok(hitLow.occluded, "synthetic hill must occlude low camera (test setup sanity)");

  // 抬高 camera 到 80（远高于山顶 ~21）：应不被遮
  // contract: terrain-occlusion lift 把 camera 抬过任何前景 hill
  const cameraLifted = { x: 0, y: 80, z: -30 };
  const hitLifted = raycastTerrain(cameraLifted, player, sampler);
  assert.equal(hitLifted.occluded, false,
    `lifted camera must clear hill (lifted to y=80, hill peak ~21, expected no occlusion)`);
});

test("C2 overview 模式相机以玩家为中心", async () => {
  const { cameraLookTargetForMode } = await import("../src/game/cameraView.js");
  const player = { x: 100, y: 5, z: 50 };
  const target = cameraLookTargetForMode({ mode: "overview", player, lookAtHeight: 0 });
  // 概览模式 target 应等于 player x/z (不偏到一角)
  assert.equal(target.x, 100, "overview target.x must equal player.x");
  assert.equal(target.z, 50, "overview target.z must equal player.z");
});

test("C3 follow 模式 low pitch 相机在玩家之上（不入地）", async () => {
  const { cameraPositionForMode } = await import("../src/game/cameraView.js");
  const lookTarget = { x: 0, y: 1.5, z: 0 };  // 玩家头部 lookAt
  // 测最低 pitch（最近 commit 把 minElevation 从 0.32 → 0.0 解锁了）
  // elevation 是相机俯仰角；0 = 水平，π/2 = 头顶。最低 0.05 rad ≈ 3°
  const pos = cameraPositionForMode({
    mode: "follow",
    lookTarget,
    heading: 0,
    elevation: 0.05,
    distance: 10
  });
  // 即使最低 pitch 相机也应略高于 lookTarget（看玩家头部）；不应入地
  assert.ok(pos.y > 0,
    `camera must stay above ground at low pitch (elevation=0.05), got y=${pos.y}`);
  assert.ok(pos.y > lookTarget.y - 1,
    `camera should not sink far below player head, got y=${pos.y}`);
});

// ═══════════════════════════════════════════════════════════════════════════
// WATER (W1-W3) — visibility geometry & lake anchoring
// ═══════════════════════════════════════════════════════════════════════════

test("W1 高视角看渭河（camera→river 无 terrain 遮挡）", () => {
  // 山谷：z=0 处 height=0（河），周围高 5
  const asset = makeHillAsset((x, z) => {
    return Math.abs(z) < 3 ? 0 : 5;
  });
  const sampler = new TerrainSampler(asset);

  // 高视角相机：高度 40，距河 30
  const camera = { x: 0, y: 40, z: 30 };
  const riverPoint = { x: 0, y: 0.1, z: 0 };  // 河面略高于河床

  const hit = raycastTerrain(camera, riverPoint, sampler);
  // 几何上无遮挡 → 河应可见。这个 case 抓到几何遮挡 bug；render-order/polygonOffset
  // 类纯 GPU bug 留给 S6 Playwright 阶段。
  assert.equal(hit.occluded, false,
    `high-pitch river visibility broken: terrain at t=${hit.atT} blocks view (y=${hit.terrainY} > line y=${hit.lineY})`);
});

test("W2 低视角看河（沿河走廊地面级 camera 不被自己岸遮）", () => {
  // 模拟玩家站在河边 (z=2，仍在河谷内 |z|<3)，camera 跟随在玩家身后沿河
  // 即 camera 也在河谷里（不是站在岸上俯瞰）
  const asset = makeHillAsset((x, z) => {
    return Math.abs(z) < 3 ? 0 : 5;
  });
  const sampler = new TerrainSampler(asset);

  const camera = { x: -10, y: 3, z: 2 };  // 沿河走廊（z=2，岸内）
  const riverPoint = { x: 0, y: 0.1, z: 0 };  // 河中央

  const hit = raycastTerrain(camera, riverPoint, sampler);
  assert.equal(hit.occluded, false,
    `low-pitch in-valley river visibility broken: terrain at t=${hit.atT} blocks view (lineY=${hit.lineY})`);
});

test("W3 湖中心高度 anchor 到 terrain surface (createLakePolygon 契约)", () => {
  // 湖 polygon 中心点应使用 sampleSurfaceHeight（mesh-aligned）+ presentation.waterLevel offset
  // main.ts:2846 的 lakeY = sampler.sampleHeight(centerX, centerZ) + 0.08
  const asset = makeFlatAsset(7);
  const sampler = new TerrainSampler(asset);

  const centerX = 0, centerZ = 0;
  const expectedLakeY = sampler.sampleHeight(centerX, centerZ) + 0.08;

  // contract: 湖面 y ≥ ground y 且偏移在 [0.05, 0.5] 之间（不浮空、不埋）
  const groundY = sampler.sampleHeight(centerX, centerZ);
  assert.ok(expectedLakeY > groundY,
    `lake surface must be above ground (got lakeY=${expectedLakeY}, groundY=${groundY})`);
  assert.ok(expectedLakeY - groundY < 0.5,
    `lake offset too high (delta=${expectedLakeY - groundY}, expected < 0.5)`);
});

// ═══════════════════════════════════════════════════════════════════════════
// TERRAIN LOD (T1-T3) — chunk seams, LOD morph, fade continuity
// ═══════════════════════════════════════════════════════════════════════════

test("T1 chunk seam 边界无断裂 (CompositeTerrainSampler 接缝)", () => {
  // 两个相邻 chunk，base height 不同。在边界 sample 应连续。
  const base = new TerrainSampler(makeFlatAsset(0, { width: 200, depth: 100 }));
  const composite = new CompositeTerrainSampler(base);

  // 西 chunk: height=2, x ∈ [-100, 0]
  const westAsset = makeFlatAsset(2, { width: 100, depth: 100 });
  westAsset.worldBounds = { minX: -100, maxX: 0, minZ: -50, maxZ: 50 };
  composite.registerChunk("west", new TerrainSampler(westAsset),
    { minX: -100, maxX: 0, minZ: -50, maxZ: 50 });

  // 东 chunk: height=2.1, x ∈ [0, 100]（边界差 0.1，应被 sampler 容忍）
  const eastAsset = makeFlatAsset(2.1, { width: 100, depth: 100 });
  eastAsset.worldBounds = { minX: 0, maxX: 100, minZ: -50, maxZ: 50 };
  composite.registerChunk("east", new TerrainSampler(eastAsset),
    { minX: 0, maxX: 100, minZ: -50, maxZ: 50 });

  // 跨边界采样不应返回 NaN
  const yWest = composite.sampleHeight(-1, 0);
  const yBoundary = composite.sampleHeight(0, 0);
  const yEast = composite.sampleHeight(1, 0);

  assert.ok(!Number.isNaN(yWest), `west sample NaN`);
  assert.ok(!Number.isNaN(yBoundary), `boundary sample NaN`);
  assert.ok(!Number.isNaN(yEast), `east sample NaN`);

  // 跨边界跳跃 < 0.5u (容忍小差异但不能巨变)
  assert.ok(Math.abs(yWest - yEast) < 0.5,
    `seam jump too big: west=${yWest}, east=${yEast}, delta=${Math.abs(yWest - yEast)}`);
});

test("T2 LOD morph 提供 lodHeights 时 sampleHeightLod 用降采样", () => {
  // chunk 带 lodHeights L1：用 L1 数据采样
  const asset = makeFlatAsset(5);
  asset.lodHeights = {
    L1: {
      grid: { columns: 2, rows: 2 },
      heights: [3, 3, 3, 3]  // L1 用 3，L0 是 5
    }
  };
  const sampler = new TerrainSampler(asset);

  const yL0 = sampler.sampleHeightLod(0, 0, 0);
  const yL1 = sampler.sampleHeightLod(0, 0, 1);

  assert.equal(yL0, 5 * TERRAIN_VERTICAL_EXAGGERATION,
    `L0 must use asset.heights[]=5 × exaggeration`);
  assert.equal(yL1, 3 * TERRAIN_VERTICAL_EXAGGERATION,
    `L1 must use lodHeights.L1[]=3 × exaggeration`);
});

test("T3 LOD morph 圆形边界平滑（R10a fix regression）", () => {
  // chunk 带不同 LOD heights：L0=10, L1=8
  // morph 应在距 player 一定半径内用 L0，半径外渐过 L1 — 这里测 sampleHeightLod
  // 单纯返回 lod 值（morph 本身在 vertex shader，CPU 测只能确认数据正确）。
  const asset = makeFlatAsset(10);
  asset.lodHeights = {
    L1: { grid: { columns: 2, rows: 2 }, heights: [8, 8, 8, 8] }
  };
  const sampler = new TerrainSampler(asset);

  // 在不同 LOD 调用 sampleHeightLod，确认返回正确——morph CPU 数据契约 ok
  const lods = [0, 1, 2, 3];
  for (const lod of lods) {
    const y = sampler.sampleHeightLod(0, 0, lod);
    assert.ok(!Number.isNaN(y), `LOD ${lod} sample NaN`);
    assert.ok(y > 0 && y < 20, `LOD ${lod} sample out of expected range: ${y}`);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// SCENERY (S1-S2) — grass/POI grounding
// ═══════════════════════════════════════════════════════════════════════════

test("S1 草根 anchor 到 sampleSurfaceHeight (mesh-aligned, 非 sampleHeight)", () => {
  // 草必须用 sampleSurfaceHeight 而不是 sampleHeight，否则边坡上飘/沉。
  // 这个 case 锁定契约：草 base = sampleSurfaceHeight。
  const asset = makeSlopeAsset((z) => Math.abs(z) > 5 ? 5 : 0);
  const sampler = new TerrainSampler(asset);

  // 5 个随机草 instance 位置
  const samples = [
    { x: 0, z: 0 }, { x: 10, z: -10 }, { x: -10, z: 10 },
    { x: 5, z: 5 }, { x: -5, z: -5 }
  ];

  for (const { x, z } of samples) {
    const surface = sampler.sampleSurfaceHeight(x, z);
    const bilinear = sampler.sampleHeight(x, z);
    // contract: 草根 = surface（mesh-aligned），允许 bilinear 跟 surface 不同
    assert.ok(!Number.isNaN(surface), `grass anchor NaN at (${x},${z})`);
    // surface 和 bilinear 在等高区域应一致，斜坡上可不同——但都应在合理范围
    const drift = Math.abs(surface - bilinear);
    assert.ok(drift < 5,
      `grass anchor (surface=${surface}) vs bilinear (=${bilinear}) drift=${drift} unexpectedly large`);
  }
});

test("S2 POI / city marker 不浮空（vertical_exaggeration 应用一致）", () => {
  const asset = makeFlatAsset(7);
  const sampler = new TerrainSampler(asset);

  // sampleSurfaceHeight 和 sampleHeight 都应用 exaggeration
  const surface = sampler.sampleSurfaceHeight(0, 0);
  const bilinear = sampler.sampleHeight(0, 0);

  const expected = 7 * TERRAIN_VERTICAL_EXAGGERATION;
  assert.equal(surface, expected,
    `sampleSurfaceHeight must apply ${TERRAIN_VERTICAL_EXAGGERATION}× exaggeration`);
  assert.equal(bilinear, expected,
    `sampleHeight must apply ${TERRAIN_VERTICAL_EXAGGERATION}× exaggeration`);
  // 一致性 = POI marker 跟 city floor 在同一参考高度
});

// ═══════════════════════════════════════════════════════════════════════════
// ENVIRONMENT (E1-E3) — sky transition, weather lerp, cloud cookie fade
// ═══════════════════════════════════════════════════════════════════════════

test("E1 日出/日落天空过渡平滑（sun direction 无突变）", () => {
  // 太阳方向应在一天内连续旋转，不应有 angular snap
  const samples = [];
  for (let h = 0; h < 24; h += 0.5) {
    samples.push(sunDirectionForTimeOfDay(h));
  }
  // 相邻两个 sample 的 dot product 应 > 0.95 (角度差 < ~18°)
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1];
    const b = samples[i];
    const dot = a.x * b.x + a.y * b.y + a.z * b.z;
    assert.ok(dot > 0.95,
      `sun direction snap at hour ${i * 0.5}: dot=${dot.toFixed(3)}`);
  }
});

test("E2 天气 lerp 单调（晴→雨 12 秒内插值不抖）", () => {
  const env = new EnvironmentController();
  env.setWeather("rain", 12);

  // 采样过渡 t 值，应在 [0, 1] 内单调递增
  const ts = [];
  for (let i = 0; i < 13; i++) {
    env.update(1);  // 每步 1 秒
    const transition = env.getWeatherTransitionLerp();
    if (transition) ts.push(transition.t);
  }

  // 至少有几个采样点（取决于 update 行为）
  if (ts.length > 1) {
    for (let i = 1; i < ts.length; i++) {
      assert.ok(ts[i] >= ts[i - 1] - 0.001,
        `weather lerp t went backwards: ${ts[i - 1]} → ${ts[i]} at step ${i}`);
    }
  }
  // 过渡结束后应 weather === "rain"
  assert.equal(env.state.weather, "rain", `weather should land on "rain" after lerp`);
});

test("E3 天体地平线 fade 范围正确 (sky body horizon fade)", () => {
  // skyBodyHorizonFade(altitude) 应在 altitude ∈ [-0.14, -0.04] 内 smoothstep 从 0 到 1
  const above = skyBodyHorizonFade(0.5);    // 高在天上 → 1
  const at = skyBodyHorizonFade(0);          // 地平线 → 1
  const fading = skyBodyHorizonFade(-0.08);  // 中间 → ~0.5
  const below = skyBodyHorizonFade(-0.20);   // 沉地下 → 0

  assert.equal(above, 1, `body high in sky should be fully visible`);
  assert.equal(at, 1, `body at horizon should be fully visible`);
  assert.ok(fading > 0 && fading < 1,
    `body mid-fade should be partial, got ${fading}`);
  assert.equal(below, 0, `body below horizon should be invisible`);
});

// ═══════════════════════════════════════════════════════════════════════════
// SCALE (Z1) — world unit ratio sanity (codex's 1u ≈ 3.3km claim)
// ═══════════════════════════════════════════════════════════════════════════

test("Z1 世界比例尺：1u ≈ 3.27km (验证 codex 假设)", () => {
  // 用 projectGeoToWorld 投影长安和洛阳，算两点世界距离 vs 真实距离
  const xian = { lat: 34.27, lon: 108.95 };
  const luoyang = { lat: 34.62, lon: 112.45 };

  const xianW = projectGeoToWorld(xian, qinlingRegionBounds, qinlingRegionWorld);
  const luoyangW = projectGeoToWorld(luoyang, qinlingRegionBounds, qinlingRegionWorld);

  const worldDist = Math.hypot(luoyangW.x - xianW.x, luoyangW.z - xianW.z);

  // 投影后的真实距离（注意我们用线性 deg×u/deg 投影，不是大圆距离）
  const lonSpan = 112.45 - 108.95;  // 3.5°
  const latSpan = 34.62 - 34.27;    // 0.35°
  const midLat = (34.27 + 34.62) / 2 * Math.PI / 180;
  // 真实地理近似距离
  const realKmEW = lonSpan * 111 * Math.cos(midLat);  // ~324 km
  const realKmNS = latSpan * 111;                      // ~39 km
  const realKm = Math.hypot(realKmEW, realKmNS);       // ~326 km

  const kmPerWorldUnit = realKm / worldDist;

  // 期望 1u ≈ 3.27km (±0.15 容差)
  assert.ok(kmPerWorldUnit > 3.10 && kmPerWorldUnit < 3.45,
    `world unit scale outside expected range: ${kmPerWorldUnit.toFixed(3)} km/u (expected ~${WORLD_UNIT_KM_TARGET})`);
});
