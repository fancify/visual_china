import assert from "node:assert/strict";
import test from "node:test";

import {
  computeLodMorph,
  resolveLodMorphOverride,
  summarizeChunkLodMorphs
} from "../src/game/terrainLodMorph.ts";

test("computeLodMorph keeps L0 before 30u and lerps through the 20% transition band", () => {
  // 阈值跟 chunk 实际尺寸校准：chunk ~15u → L0_DISTANCE=30 (2 radii) / L1_DISTANCE=90 (4 radii)
  // morph 区间 30→42u (12u 宽，等于 (90-30)*0.2)
  assert.equal(computeLodMorph(29.99), 0);
  assert.equal(computeLodMorph(30), 0);
  assert.equal(computeLodMorph(36), 0.5);
  assert.equal(computeLodMorph(42), 1);
  assert.equal(computeLodMorph(90), 1);
});

test("computeLodMorph only dispatches the R4 L0 to L1 morph", () => {
  assert.equal(computeLodMorph(400), 1);
  assert.equal(computeLodMorph(420), 1);
  assert.equal(computeLodMorph(1000), 1);
});

test("summarizeChunkLodMorphs groups visible chunks into HUD L0 and L1 buckets", () => {
  const summary = summarizeChunkLodMorphs([0, 0.49, 0.5, 1], 1);

  assert.deepEqual(summary, { L0: 2, L1: 2, L2: 0, hidden: 1 });
});

test("resolveLodMorphOverride clamps numeric dev overrides and ignores undefined", () => {
  assert.equal(resolveLodMorphOverride(undefined), null);
  assert.equal(resolveLodMorphOverride(Number.NaN), null);
  assert.equal(resolveLodMorphOverride(-1), 0);
  assert.equal(resolveLodMorphOverride(0.25), 0.25);
  assert.equal(resolveLodMorphOverride(2), 1);
});
