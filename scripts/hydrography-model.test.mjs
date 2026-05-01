import assert from "node:assert/strict";
import test from "node:test";

import {
  hydrographyFeatureKey,
  hydrographyVisibleAtLod,
  normalizeHydrographyFeature
} from "../src/game/hydrographyModel.js";

test("normalizes a modern river with required source metadata", () => {
  const feature = normalizeHydrographyFeature({
    id: "river-hanjiang",
    name: "汉江/汉水",
    kind: "river",
    rank: 1,
    basin: "长江流域",
    eraId: "modern",
    source: { name: "curated-modern-qinling", confidence: "medium" },
    geometry: { points: [{ x: 0, y: 0 }, { x: 10, y: 5 }] }
  });

  assert.deepEqual(feature.aliases, []);
  assert.deepEqual(feature.relations, []);
  assert.equal(feature.eraId, "modern");
  assert.equal(feature.source.confidence, "medium");
  assert.equal(hydrographyFeatureKey(feature), "modern:river-hanjiang");
});

test("filters hydrography by lod and river rank", () => {
  const river = normalizeHydrographyFeature({
    id: "river-weihe",
    name: "渭河",
    kind: "river",
    rank: 1,
    basin: "黄河流域",
    eraId: "modern",
    source: { name: "curated-modern-qinling", confidence: "medium" },
    geometry: { points: [{ x: 0, y: 0 }, { x: 10, y: 0 }] }
  });
  const stream = normalizeHydrographyFeature({
    id: "stream-xieshui",
    name: "斜水",
    kind: "stream",
    rank: 3,
    basin: "黄河流域",
    eraId: "modern",
    source: { name: "curated-modern-qinling", confidence: "medium" },
    geometry: { points: [{ x: 0, y: 0 }, { x: 2, y: 3 }] }
  });

  assert.equal(hydrographyVisibleAtLod(river, "l0"), true);
  assert.equal(hydrographyVisibleAtLod(stream, "l0"), false);
  assert.equal(hydrographyVisibleAtLod(stream, "l1"), true);
});
