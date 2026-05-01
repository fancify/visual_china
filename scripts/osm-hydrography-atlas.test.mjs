import assert from "node:assert/strict";
import test from "node:test";

import {
  importedHydrographyAssetToAtlasFeatures,
  importedHydrographyFeatureToAtlasFeature,
  importedWaterDisplayPriority
} from "../src/game/osmHydrographyAtlas.js";

const baseFeature = {
  id: "osm-way-1",
  name: "测试河",
  aliases: [],
  kind: "river",
  rank: 1,
  basin: "待核验流域",
  eraId: "modern",
  source: { name: "openstreetmap-overpass", confidence: "medium" },
  relations: [],
  geometry: { points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] }
};

test("promotes known backbone rivers above generic imported waterways", () => {
  assert.equal(importedWaterDisplayPriority({ ...baseFeature, name: "渭河" }), 8);
  assert.equal(importedWaterDisplayPriority({ ...baseFeature, name: "地方河" }), 5);
  assert.equal(
    importedWaterDisplayPriority({ ...baseFeature, name: "地方溪", kind: "stream" }),
    4
  );
  assert.equal(
    importedWaterDisplayPriority({ ...baseFeature, name: "灌渠", kind: "canal" }),
    2
  );
});

test("converts imported waterways into atlas evidence features", () => {
  const atlasFeature = importedHydrographyFeatureToAtlasFeature({
    ...baseFeature,
    name: "褒河"
  });

  assert.equal(atlasFeature.id, "osm-water-osm-way-1");
  assert.equal(atlasFeature.layer, "water");
  assert.equal(atlasFeature.displayPriority, 8);
  assert.equal(atlasFeature.terrainRole, "main-river-evidence");
  assert.ok(atlasFeature.themes.includes("evidence"));
  assert.match(atlasFeature.copy.summary, /OSM/);
});

test("sorts imported hydrography features by atlas display priority", () => {
  const features = importedHydrographyAssetToAtlasFeatures({
    features: [
      { ...baseFeature, id: "osm-way-2", name: "灌渠", kind: "canal" },
      { ...baseFeature, id: "osm-way-3", name: "汉江" }
    ]
  });

  assert.deepEqual(features.map((feature) => feature.id), [
    "osm-water-osm-way-3",
    "osm-water-osm-way-2"
  ]);
});
