import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const asset = JSON.parse(
  await readFile("public/data/regions/qinling/hydrography/osm-modern.json", "utf8")
);

test("Qinling OSM hydrography asset declares imported source metadata", () => {
  assert.equal(asset.regionId, "qinling");
  assert.equal(asset.eraId, "modern");
  assert.equal(asset.source.name, "openstreetmap-overpass");
  assert.equal(asset.source.license, "ODbL-1.0");
  assert.equal(asset.sourceAsset, "data/hydrography/raw/qinling-osm-waterways.overpass.json");
});

test("Qinling OSM hydrography asset contains in-bounds waterway features", () => {
  assert.ok(asset.features.length > 0, "OSM import should contain waterways");

  asset.features.forEach((feature) => {
    assert.ok(["river", "stream", "canal"].includes(feature.kind));
    assert.ok(feature.geometry.points.length >= 2);
    feature.geometry.points.forEach((point) => {
      assert.ok(point.x >= -90 && point.x <= 90);
      assert.ok(point.y >= -120 && point.y <= 120);
    });
  });
});
