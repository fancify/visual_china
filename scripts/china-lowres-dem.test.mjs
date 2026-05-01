import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const assetPath = "public/data/china-lowres-dem.json";

test("low-resolution China DEM asset is a lightweight national overview", () => {
  assert.ok(fs.existsSync(assetPath), `${assetPath} should be generated`);

  const asset = JSON.parse(fs.readFileSync(assetPath, "utf8"));
  const cellCount = asset.grid.columns * asset.grid.rows;

  assert.equal(asset.name, "china-lowres-etopo-2022-60s");
  assert.equal(asset.sourceType, "ETOPO 2022 60 arc-second");
  assert.deepEqual(asset.bounds, { west: 73, east: 135, south: 18, north: 54 });
  assert.ok(asset.grid.columns <= 576, "national overview should stay browser-light");
  assert.ok(asset.grid.rows <= 336, "national overview should stay browser-light");
  assert.ok(asset.minHeight >= 0, "overview terrain should clamp bathymetry to sea level");
  assert.equal(asset.heights.length, cellCount);
  assert.equal(asset.riverMask.length, cellCount);
  assert.equal(asset.passMask.length, cellCount);
  assert.equal(asset.settlementMask.length, cellCount);
  assert.ok(
    asset.notes.some((note) => note.includes("low-resolution national overview")),
    "asset should document that it is a low-resolution national overview"
  );
});
