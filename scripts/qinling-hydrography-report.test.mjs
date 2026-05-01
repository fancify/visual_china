import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const report = JSON.parse(
  await readFile("public/data/regions/qinling/hydrography/dem-mismatch-report.json", "utf8")
);

test("Qinling hydrography DEM report records validation metadata", () => {
  assert.equal(report.schema, "visual-china.hydrography-dem-validation.v1");
  assert.equal(report.sourceAsset.hydrography, "public/data/regions/qinling/hydrography/modern.json");
  assert.equal(report.sourceAsset.dem, "public/data/qinling-slice-dem.json");
  assert.ok(Array.isArray(report.interpretation));
});

test("Qinling hydrography DEM report summarizes current QA signals", () => {
  assert.equal(report.summary.featureCount, 5);
  assert.equal(report.summary.totalPoints, 21);
  assert.equal(
    report.summary.problemPoints,
    report.summary.issueCounts["low-river-affinity"]
  );
});
