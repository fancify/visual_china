import assert from "node:assert/strict";
import test from "node:test";

import {
  qinlingAtlasFeatures,
  qinlingAtlasLayers,
  qinlingAtlasPolicy,
  qinlingAtlasRequiredNames,
  qinlingWaterSystem
} from "../src/game/qinlingAtlas.js";

const featuresByName = new Map(
  qinlingAtlasFeatures.map((feature) => [feature.name, feature])
);

test("Qinling 2D atlas has the required independent map layers", () => {
  // 用户要求 atlas 跟 3D 主游戏对齐——3D 没有 landform / road / culture /
  // military 这些手画"意象"层，所以 atlas 也只留 4 层：水系 / 城市 /
  // 关隘 / 民生（都江堰水利工程）。
  assert.deepEqual(
    qinlingAtlasLayers.map((layer) => layer.id),
    ["water", "city", "pass", "scenic", "ancient", "livelihood"]
  );
  assert.equal(qinlingAtlasPolicy.coordinatePolicy, "strict-geographic");
  assert.equal(qinlingAtlasPolicy.sourceOfTruth, "2d-atlas-first");
});

test("Qinling 2D atlas contains named geography needed for the slice narrative", () => {
  for (const name of qinlingAtlasRequiredNames) {
    assert.ok(featuresByName.has(name), `${name} must exist in the 2D atlas`);
  }

  for (const name of ["潼关", "华山", "重庆", "涪陵", "泸州", "宜宾"]) {
    assert.ok(featuresByName.has(name), `${name} should be visible after the east/south expansion`);
  }
});

test("Qinling atlas features are renderable and carry gameplay-facing semantics", () => {
  for (const feature of qinlingAtlasFeatures) {
    assert.ok(feature.id, "feature needs stable id");
    assert.ok(feature.name, "feature needs display name");
    assert.ok(feature.layer, `${feature.name} needs a layer`);
    assert.ok(feature.copy?.summary, `${feature.name} needs short copy`);
    assert.ok(feature.visualRule?.symbol, `${feature.name} needs a visual symbol`);
    assert.ok(feature.terrainRole, `${feature.name} needs a terrain role`);
    assert.ok(feature.world, `${feature.name} needs world coordinates`);

    const points = Array.isArray(feature.world)
      ? feature.world
      : feature.world.points ?? [feature.world];

    for (const point of points) {
      assert.ok(point.x >= -96.5 && point.x <= 96.5, `${feature.name} x is in slice bounds`);
      assert.ok(point.y >= -165.5 && point.y <= 165.5, `${feature.name} y is in slice bounds`);
    }
  }
});

test("Qinling atlas explicitly models the visible water system", () => {
  const waterNames = qinlingWaterSystem.map((feature) => feature.name);

  assert.ok(waterNames.includes("渭河"), "渭河 must be visible north of Qinling");
  assert.ok(waterNames.includes("汉水"), "汉水 must be visible through Hanzhong");
  assert.ok(waterNames.includes("嘉陵江"), "嘉陵江 must be visible near Guangyuan/Jianmen");
  // 2026-05 user "只要 prototype 里有的" - prototype is NE only.
  // 褒水/岷江/内江 were OSM, dropped. 长江/沱江 are NE additions inside slice.
  assert.ok(waterNames.includes("长江"), "长江 must be visible at slice south edge (Three Gorges entry)");
  assert.ok(waterNames.includes("沱江"), "沱江 must be visible in 四川盆地 east");

  for (const river of qinlingWaterSystem) {
    assert.equal(river.layer, "water");
    assert.equal(river.geometry, "polyline");
    assert.ok(river.world.points.length >= 2, `${river.name} needs a polyline`);
  }
});
