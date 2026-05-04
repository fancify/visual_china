import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { qinlingModernHydrography } from "../src/game/qinlingHydrography.js";

const asset = JSON.parse(
  await readFile("public/data/regions/qinling/hydrography/modern.json", "utf8")
);

test("Qinling modern hydrography asset declares modern base metadata", () => {
  assert.equal(asset.regionId, "qinling");
  assert.equal(asset.eraId, "modern");
  assert.equal(asset.basePolicy, "modern-hydrography");
});

test("Qinling modern hydrography includes first required river skeleton", () => {
  const names = asset.features.map((feature) => feature.name);

  // 2026-05 slice 扩到 28.5-35.4 / 103.5-110.5 后，现代水系必须至少覆盖
  // 扩入区域里的主干河流：长江、金沙江、岷江、嘉陵江、乌江、沱江。
  // 旧 slice 里的渭河、汉水也仍需保留。
  ["长江", "金沙江", "岷江", "嘉陵江", "乌江", "沱江", "渭河", "汉水"].forEach((name) => {
    assert.ok(names.includes(name), `${name} must be present`);
  });
});

test("all hydrography features have source confidence and at least two points", () => {
  asset.features.forEach((feature) => {
    assert.ok(["high", "medium", "low"].includes(feature.source.confidence));
    assert.ok(feature.geometry.points.length >= 2);
  });
});

test("runtime hydrography data mirrors the exported public asset", () => {
  assert.deepEqual(qinlingModernHydrography, asset);
});
