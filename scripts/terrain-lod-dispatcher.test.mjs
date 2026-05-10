import assert from "node:assert/strict";
import test from "node:test";

import {
  computeLodMorph,
  formatTerrainLodBreakdown,
  resolveLodMorphOverride,
  summarizeChunkLodMorphs
} from "../src/game/terrainLodMorph.ts";

test("computeLodMorph mirrors the per-vertex shader smoothstep from 60u to 120u", () => {
  // R10a-fix: morph zone 推到 scenery spawn radius (50u) 之外，避免 scenery anchor 浮埋。
  assert.equal(computeLodMorph(59.99), 0);
  assert.equal(computeLodMorph(60), 0);
  assert.equal(computeLodMorph(90), 0.5);
  assert.equal(computeLodMorph(120), 1);
});

test("computeLodMorph saturates distant vertices at L1", () => {
  assert.equal(computeLodMorph(400), 1);
  assert.equal(computeLodMorph(420), 1);
  assert.equal(computeLodMorph(1000), 1);
});

test("summarizeChunkLodMorphs groups chunk-center effective morph into L0 blend and L1 buckets", () => {
  const summary = summarizeChunkLodMorphs([0, 0.25, 0.99, 1], 1);

  assert.deepEqual(summary, { L0: 1, blend: 2, L1: 1, hidden: 1 });
  assert.equal(
    formatTerrainLodBreakdown(summary),
    "LOD(center): L0=1 blend=2 L1=1 hidden=1"
  );
});

test("resolveLodMorphOverride clamps numeric dev overrides and ignores undefined", () => {
  assert.equal(resolveLodMorphOverride(undefined), null);
  assert.equal(resolveLodMorphOverride(Number.NaN), null);
  assert.equal(resolveLodMorphOverride(-1), 0);
  assert.equal(resolveLodMorphOverride(0.25), 0.25);
  assert.equal(resolveLodMorphOverride(2), 1);
});
