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

  // 2026-05 用户："去掉目前的河，用新做的河来代替" — qinlingHydrography
  // 全部从 NE/OSM 派生。斜水/外江 在数据源里没有，dropped。新增长江/沱江/内江。
  // 名字 "汉江/汉水" 简化为 "汉水" (NE 标准名)。
  ["长江", "渭河", "汉水", "嘉陵江", "岷江", "沱江", "褒河", "内江"].forEach((name) => {
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
