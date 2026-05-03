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

  // 2026-05 用户："只要 prototype 里有的。其他的都去掉"
  // → 只保留 major-rivers.json (NE 10m only) 在 slice 内的 5 条河。
  // 岷江/褒河/内江 之前是 OSM 拼的，prototype 没用 OSM，全 dropped。
  ["长江", "渭河", "汉水", "嘉陵江", "沱江"].forEach((name) => {
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
