import assert from "node:assert/strict";
import test from "node:test";

import { hydrographyFeatureToAtlasFeature } from "../src/game/hydrographyAtlas.js";

test("converts a modern river to an atlas water feature", () => {
  const atlasFeature = hydrographyFeatureToAtlasFeature({
    id: "river-weihe",
    name: "渭河",
    aliases: [],
    kind: "river",
    rank: 1,
    basin: "黄河流域",
    eraId: "modern",
    source: { name: "curated-modern-qinling", confidence: "medium" },
    relations: ["city-changan"],
    geometry: { points: [{ x: 0, y: 0 }, { x: 10, y: 1 }] }
  });

  assert.equal(atlasFeature.id, "water-weihe");
  assert.equal(atlasFeature.layer, "water");
  assert.equal(atlasFeature.geometry, "polyline");
  assert.equal(atlasFeature.visualRule.emphasis, "main-river");
});

test("converts tributary streams to lower-priority water features", () => {
  const atlasFeature = hydrographyFeatureToAtlasFeature({
    id: "stream-baohe",
    name: "褒河",
    aliases: ["褒水"],
    kind: "stream",
    rank: 3,
    basin: "汉江流域",
    eraId: "modern",
    source: { name: "curated-modern-qinling", confidence: "medium" },
    relations: ["road-baoxie"],
    geometry: { points: [{ x: 0, y: 0 }, { x: 2, y: 5 }] }
  });

  assert.equal(atlasFeature.displayPriority, 7);
  assert.equal(atlasFeature.terrainRole, "tributary-river");
  assert.match(atlasFeature.copy.summary, /汉江流域/);
});

test("converts primary tributaries into visible L1 water features", () => {
  const atlasFeature = hydrographyFeatureToAtlasFeature({
    id: "river-fenghe",
    name: "沣河",
    aliases: [],
    kind: "river",
    rank: 2,
    basin: "黄河流域",
    eraId: "modern",
    source: { name: "primary-modern-qinling", confidence: "medium", verification: "external-vector" },
    relations: [],
    geometry: { points: [{ x: 0, y: 0 }, { x: 4, y: 8 }] }
  });

  assert.equal(atlasFeature.displayPriority, 8);
  assert.equal(atlasFeature.terrainRole, "primary-tributary");
});

test("uses atlas display names without changing the underlying hydrography name", () => {
  const atlasFeature = hydrographyFeatureToAtlasFeature({
    id: "river-hanjiang",
    name: "汉江/汉水",
    displayName: "汉水",
    aliases: ["汉水"],
    kind: "river",
    rank: 1,
    basin: "长江流域",
    eraId: "modern",
    source: { name: "curated-modern-qinling", confidence: "medium" },
    relations: ["city-hanzhong"],
    geometry: { points: [{ x: 0, y: 0 }, { x: 8, y: 1 }] }
  });

  assert.equal(atlasFeature.name, "汉水");
  assert.match(atlasFeature.copy.summary, /汉江\/汉水/);
});
