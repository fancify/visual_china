// S3a SurfaceProvider 契约 + 默认实现测试
//
// 测什么：
// - sampleGround 返回完整 SurfaceSample（含 state.material/wetness/traction/footstep 等）
// - sampleWater 区分 none/river kind
// - classifyDistance near/mid/far 边界 + bandT
// - material 推断：river mask 优先于 biome；湿度/雪 注入合理
// - traction/reflectivity/footstep 与 material+state 一致

import test from "node:test";
import assert from "node:assert/strict";

import { TerrainSampler } from "../src/game/demSampler.ts";
import { EnvironmentController } from "../src/game/environment.ts";
import {
  QinlingSurfaceProvider,
  DISTANCE_BAND_NEAR,
  DISTANCE_BAND_FAR
} from "../src/game/surfaceProvider.ts";

// ─── 合成 DEM（全国 bounds 73-135°E × 18-53°N） ──────────────────────
function makeAsset(height, riverMaskValue = 0, grid = { columns: 16, rows: 16 }) {
  const n = grid.columns * grid.rows;
  return {
    id: "test",
    name: "test",
    sourceType: "unit-test",
    generatedAt: "2026-05-11T00:00:00.000Z",
    bounds: { west: 73, east: 135, south: 18, north: 53 },
    world: { width: 1711, depth: 1186 },
    grid,
    minHeight: height,
    maxHeight: height,
    heights: new Array(n).fill(height),
    riverMask: new Array(n).fill(riverMaskValue),
    passMask: new Array(n).fill(0),
    settlementMask: new Array(n).fill(0)
  };
}

function makeProvider(opts = {}) {
  const sampler = new TerrainSampler(makeAsset(opts.height ?? 5, opts.river ?? 0));
  const environment = new EnvironmentController();
  if (opts.weather) environment.state.weather = opts.weather;
  if (opts.season) environment.state.season = opts.season;
  return new QinlingSurfaceProvider({ sampler, environment });
}

// ═══════════════════════════════════════════════════════════════════════
// Contract shape — 返回字段齐全
// ═══════════════════════════════════════════════════════════════════════

test("sampleGround 返回完整 SurfaceSample 形状", () => {
  const provider = makeProvider({ height: 5 });
  const s = provider.sampleGround({ x: 0, z: 0 });

  assert.ok(typeof s.groundY === "number" && !Number.isNaN(s.groundY));
  assert.ok(typeof s.renderY === "number" && !Number.isNaN(s.renderY));
  assert.ok(s.normal && typeof s.normal.x === "number");
  assert.ok(typeof s.slope === "number");
  assert.equal(s.source, "base");
  assert.ok(s.state.material, "material 必须存在");
  assert.ok(typeof s.state.wetness === "number");
  assert.ok(typeof s.state.traction === "number" && s.state.traction >= 0 && s.state.traction <= 1);
  assert.ok(s.state.footstep);
});

test("sampleWater 干燥时返回 kind=none", () => {
  const provider = makeProvider({ height: 5, river: 0 });
  const w = provider.sampleWater({ x: 0, z: 0 });
  assert.equal(w.kind, "none");
  assert.equal(w.visibility, 0);
});

test("sampleWater 高 river mask 时返回 kind=river + visibility>0", () => {
  const provider = makeProvider({ height: 2, river: 0.8 });
  const w = provider.sampleWater({ x: 0, z: 0 });
  assert.equal(w.kind, "river");
  assert.ok(w.visibility > 0.5, `visibility too low: ${w.visibility}`);
  assert.ok(w.surfaceY > w.bedY, "surface 应高于 bed");
});

// ═══════════════════════════════════════════════════════════════════════
// classifyDistance band 边界
// ═══════════════════════════════════════════════════════════════════════

test("classifyDistance near band: 0-30u", () => {
  const provider = makeProvider();
  const camera = { x: 0, z: 0 };
  const d1 = provider.classifyDistance({ x: 5, z: 0 }, camera);
  assert.equal(d1.band, "near");
  assert.ok(d1.bandT > 0 && d1.bandT < 0.2);

  const d2 = provider.classifyDistance({ x: DISTANCE_BAND_NEAR - 0.01, z: 0 }, camera);
  assert.equal(d2.band, "near");
  assert.ok(d2.bandT > 0.99);
});

test("classifyDistance mid band: 30-120u", () => {
  const provider = makeProvider();
  const camera = { x: 0, z: 0 };
  const d = provider.classifyDistance({ x: 75, z: 0 }, camera);
  assert.equal(d.band, "mid");
  assert.ok(d.bandT > 0.4 && d.bandT < 0.7);
});

test("classifyDistance far band: 120u+", () => {
  const provider = makeProvider();
  const camera = { x: 0, z: 0 };
  const d1 = provider.classifyDistance({ x: 150, z: 0 }, camera);
  assert.equal(d1.band, "far");

  const d2 = provider.classifyDistance({ x: 500, z: 0 }, camera);
  assert.equal(d2.band, "far");
  assert.equal(d2.bandT, 1, "far bandT 在 > 2 × FAR 后稳定到 1");
});

// ═══════════════════════════════════════════════════════════════════════
// Material 推断
// ═══════════════════════════════════════════════════════════════════════

test("material: river mask > 0.5 时强制为 water", () => {
  const provider = makeProvider({ height: 3, river: 0.7 });
  const s = provider.sampleGround({ x: 0, z: 0 });
  assert.equal(s.state.material, "water");
  assert.equal(s.state.footstep, "water");
  assert.equal(s.state.waterDepth, 0.5);
});

test("material: river mask < 0.5 时根据 biome 推断", () => {
  // 全国画幅中心 (0, 0) 大约在秦岭附近 — biome 是 warm-temperate-humid 类
  const provider = makeProvider({ height: 5, river: 0 });
  const s = provider.sampleGround({ x: 0, z: 0 });
  assert.notEqual(s.state.material, "water");
});

// ═══════════════════════════════════════════════════════════════════════
// Weather × Season 注入
// ═══════════════════════════════════════════════════════════════════════

test("rain weather → wetness 升、traction 降", () => {
  const dry = makeProvider({ height: 5, weather: "clear" });
  const wet = makeProvider({ height: 5, weather: "rain" });

  const dryS = dry.sampleGround({ x: 0, z: 0 });
  const wetS = wet.sampleGround({ x: 0, z: 0 });

  assert.ok(wetS.state.wetness > dryS.state.wetness, "rain 时 wetness 应升");
  assert.ok(
    wetS.state.traction < dryS.state.traction,
    "rain 时 traction 应降 (湿滑)"
  );
  assert.ok(
    wetS.state.reflectivity > dryS.state.reflectivity,
    "rain 时 reflectivity 应升 (水面反光)"
  );
});

test("snow weather → snowCover 升", () => {
  const clear = makeProvider({ height: 5, weather: "clear", season: "summer" });
  const snow = makeProvider({ height: 5, weather: "snow", season: "winter" });

  const clearS = clear.sampleGround({ x: 0, z: 0 });
  const snowS = snow.sampleGround({ x: 0, z: 0 });

  assert.equal(clearS.state.snowCover, 0);
  assert.ok(snowS.state.snowCover > 0.5);
});

test("winter season（无 snow weather）也有部分 snowCover", () => {
  const winter = makeProvider({ height: 5, weather: "clear", season: "winter" });
  const summer = makeProvider({ height: 5, weather: "clear", season: "summer" });

  const wS = winter.sampleGround({ x: 0, z: 0 });
  const sS = summer.sampleGround({ x: 0, z: 0 });

  assert.ok(wS.state.snowCover > 0);
  assert.equal(sS.state.snowCover, 0);
});

// ═══════════════════════════════════════════════════════════════════════
// Slope 计算
// ═══════════════════════════════════════════════════════════════════════

test("flat terrain → slope ≈ 0", () => {
  const provider = makeProvider({ height: 5 });
  const s = provider.sampleGround({ x: 0, z: 0 });
  assert.ok(s.slope < 0.01, `flat slope should be ~0, got ${s.slope}`);
});

test("法线在平地指向 +Y", () => {
  const provider = makeProvider({ height: 5 });
  const s = provider.sampleGround({ x: 0, z: 0 });
  assert.ok(s.normal.y > 0.99, `normal.y should be ~1 on flat, got ${s.normal.y}`);
});

// ═══════════════════════════════════════════════════════════════════════
// Epoch ID — S4 切换准备
// ═══════════════════════════════════════════════════════════════════════

test("epochId 默认 modern；可通过 options 切换", () => {
  const sampler = new TerrainSampler(makeAsset(5));
  const env = new EnvironmentController();

  const modern = new QinlingSurfaceProvider({ sampler, environment: env });
  assert.equal(modern.epochId, "modern");

  const tang = new QinlingSurfaceProvider({
    sampler,
    environment: env,
    epochId: "tang-tianbao-14"
  });
  assert.equal(tang.epochId, "tang-tianbao-14");
});
