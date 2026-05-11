// S4a EpochManifest schema validation tests
//
// 测什么：
// - 现有 modern + tang-tianbao-14 manifest 文件 schema valid
// - validateEpochManifest 能捕获缺字段、错 schema version、错 projection
// - epochChunkCacheKey 格式稳定

import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  validateEpochManifest,
  epochChunkCacheKey
} from "../src/game/epoch.ts";

const MODERN_PATH = "public/data/epochs/modern/manifest.json";
const TANG_PATH = "public/data/epochs/tang-tianbao-14/manifest.json";

// ─── 实际 manifest 文件验证 ─────────────────────────────────────────

test("modern epoch manifest schema valid", async () => {
  const raw = JSON.parse(await readFile(MODERN_PATH, "utf8"));
  const result = validateEpochManifest(raw);
  assert.equal(
    result.ok,
    true,
    `modern manifest invalid: ${JSON.stringify(result.issues, null, 2)}`
  );
  assert.equal(result.manifest?.epochId, "modern");
  assert.equal(result.manifest?.year, 2026);
});

test("tang-tianbao-14 epoch manifest schema valid", async () => {
  const raw = JSON.parse(await readFile(TANG_PATH, "utf8"));
  const result = validateEpochManifest(raw);
  assert.equal(
    result.ok,
    true,
    `tang manifest invalid: ${JSON.stringify(result.issues, null, 2)}`
  );
  assert.equal(result.manifest?.epochId, "tang-tianbao-14");
  assert.equal(result.manifest?.year, 755);
});

test("两个 manifest 共用同一 projection（modern 是 Tang 的 fallback）", async () => {
  const modern = JSON.parse(await readFile(MODERN_PATH, "utf8"));
  const tang = JSON.parse(await readFile(TANG_PATH, "utf8"));
  assert.deepEqual(modern.projection.bounds, tang.projection.bounds);
  assert.deepEqual(modern.projection.world, tang.projection.world);
});

// ─── validateEpochManifest 反例 ────────────────────────────────────

test("validate: 拒绝非 object", () => {
  const r = validateEpochManifest("not an object");
  assert.equal(r.ok, false);
  assert.ok(r.issues.length > 0);
});

test("validate: 拒绝错 schema version", () => {
  const r = validateEpochManifest({
    schemaVersion: "wrong-version"
  });
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => i.path === "schemaVersion"));
});

test("validate: 缺必需顶级字段时报错", () => {
  const r = validateEpochManifest({
    schemaVersion: "visual-china.epoch-manifest.v1"
  });
  assert.equal(r.ok, false);
  const paths = r.issues.map((i) => i.path);
  for (const required of ["worldId", "regionId", "epochId", "label", "year",
                            "projection", "terrain", "hydrography", "settlements",
                            "routes", "poi", "visualProfile", "landmarkHierarchy"]) {
    assert.ok(paths.includes(required), `应缺 ${required}`);
  }
});

test("validate: projection.bounds 字段类型错时报错", () => {
  const r = validateEpochManifest({
    schemaVersion: "visual-china.epoch-manifest.v1",
    worldId: "china", regionId: "qinling", epochId: "test",
    label: "test", year: 0, description: "",
    projection: {
      bounds: { west: "not a number" }, // 错类型
      world: { width: 100, depth: 100 },
      policy: "strict-geographic"
    },
    terrain: {}, hydrography: {}, settlements: {},
    routes: {}, poi: {}, visualProfile: {},
    landmarkHierarchy: { large: [], medium: [], small: [] },
    sourceQuality: {}
  });
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => i.path === "projection.bounds"));
});

test("validate: landmarkHierarchy tier 必须是数组", () => {
  const r = validateEpochManifest({
    schemaVersion: "visual-china.epoch-manifest.v1",
    worldId: "x", regionId: "y", epochId: "z",
    label: "L", year: 0, description: "D",
    projection: { bounds: { west: 0, east: 1, south: 0, north: 1 }, world: { width: 1, depth: 1 }, policy: "strict-geographic" },
    terrain: {}, hydrography: {}, settlements: {},
    routes: {}, poi: {}, visualProfile: {},
    landmarkHierarchy: { large: "not array" },
    sourceQuality: {}
  });
  assert.equal(r.ok, false);
  assert.ok(r.issues.some((i) => i.path === "landmarkHierarchy.large"));
});

// ─── epochChunkCacheKey 格式 ────────────────────────────────────────

test("epochChunkCacheKey 格式: world:region:epoch:lod:chunkId", () => {
  const key = epochChunkCacheKey(
    { worldId: "china", regionId: "qinling", epochId: "tang-tianbao-14" },
    1,
    "qinling_3_5"
  );
  assert.equal(key, "china:qinling:tang-tianbao-14:1:qinling_3_5");
});

test("epochChunkCacheKey: 不同 epoch 产生不同 key（cache 不撞）", () => {
  const m = { worldId: "china", regionId: "qinling" };
  const modernKey = epochChunkCacheKey({ ...m, epochId: "modern" }, 0, "abc");
  const tangKey = epochChunkCacheKey({ ...m, epochId: "tang-tianbao-14" }, 0, "abc");
  assert.notEqual(modernKey, tangKey);
});

// ─── Tang epoch 内容 sanity ────────────────────────────────────────

test("tang epoch gravityWell 是长安（不是西安）", async () => {
  const raw = JSON.parse(await readFile(TANG_PATH, "utf8"));
  assert.equal(raw.landmarkHierarchy.gravityWell.id, "changan");
  assert.ok(raw.landmarkHierarchy.gravityWell.label.includes("长安"));
});

test("tang epoch large 地标包含安史起兵地 (幽州)", async () => {
  const raw = JSON.parse(await readFile(TANG_PATH, "utf8"));
  const youzhou = raw.landmarkHierarchy.large.find((n) => n.id === "youzhou");
  assert.ok(youzhou, "幽州应在 large 列表");
  assert.ok(youzhou.label.includes("范阳") || youzhou.label.includes("安禄山"));
});

test("tang epoch sourceQuality 标记 hydrography 为 speculative（S4b 待填）", async () => {
  const raw = JSON.parse(await readFile(TANG_PATH, "utf8"));
  assert.equal(raw.sourceQuality.hydrography, "speculative");
});
