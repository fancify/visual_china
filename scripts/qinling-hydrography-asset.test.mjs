import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { buildNeRiverGeometry, simplifyPolyline } from "./build-qinling-hydrography-from-ne.mjs";
import { qinlingModernHydrography } from "../src/game/qinlingHydrography.js";
import { qinlingNeRivers } from "../src/game/data/qinlingNeRivers.js";

const asset = JSON.parse(
  await readFile("public/data/regions/qinling/hydrography/modern.json", "utf8")
);
const neSource = JSON.parse(
  await readFile("public/data/china/major-rivers.json", "utf8")
);
const hydroBuildScript = await readFile("scripts/build-qinling-hydrography-from-ne.mjs", "utf8");

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
  ["长江", "金沙江", "岷江", "嘉陵江", "乌江", "沱江", "渭河", "汉水", "沅江"].forEach((name) => {
    assert.ok(names.includes(name), `${name} must be present`);
  });
});

test("simplifyPolyline keeps endpoints while collapsing dense collinear points", () => {
  const simplified = simplifyPolyline([
    { lon: 104.0, lat: 30.0 },
    { lon: 104.1, lat: 30.1 },
    { lon: 104.2, lat: 30.2 },
    { lon: 104.3, lat: 30.3 }
  ], 0.01);

  assert.deepEqual(simplified, [
    { lon: 104.0, lat: 30.0 },
    { lon: 104.3, lat: 30.3 }
  ]);
});

test("NE hydrography build greedily chains southern Wujiang source branches into the main stem", () => {
  const wujiangSource = neSource.rivers.find((river) => river.name === "乌江");
  assert.ok(wujiangSource, "Wujiang should exist in the Natural Earth source snapshot");

  const wujiang = buildNeRiverGeometry(wujiangSource, { flowDir: "lat-asc" });
  const minPrimaryLat = Math.min(...wujiang.points.map((point) => point.lat));
  const minExtraLat =
    wujiang.extraPolylines.length > 0
      ? Math.min(...wujiang.extraPolylines.flat().map((point) => point.lat))
      : Number.POSITIVE_INFINITY;

  assert.ok(wujiang.points.length < 1000, `Wujiang main stem should be simplified below 1000 points, got ${wujiang.points.length}`);
  assert.ok(minPrimaryLat < 26.5, `Wujiang main stem should extend south to the Liupanshui-level source fan, got min lat ${minPrimaryLat}`);
  assert.ok(
    minExtraLat >= minPrimaryLat,
    `Wujiang extras should not retain a farther-south branch than the main stem, got main ${minPrimaryLat} extra ${minExtraLat}`
  );
});

test("NE hydrography build simplifies large southern rivers to manageable point counts", () => {
  const yuanjiangSource = neSource.rivers.find((river) => river.name === "沅江");
  assert.ok(yuanjiangSource, "Yuanjiang should exist in the Natural Earth source snapshot");

  const yuanjiang = buildNeRiverGeometry(yuanjiangSource, { flowDir: "lat-asc" });

  assert.ok(yuanjiang.points.length < 1000, `Yuanjiang main stem should be simplified below 1000 points, got ${yuanjiang.points.length}`);
  assert.equal(qinlingNeRivers["river-yuanjiang"]?.displayName, "沅江");
});

test("hydrography build script tracks unresolved southern source gaps explicitly", () => {
  ["红水河", "漓江", "邕江"].forEach((name) => {
    assert.ok(
      hydroBuildScript.includes(name),
      `${name} should be called out in the hydrography build script as a local source gap`
    );
  });
});

test("hydrography build script maps Xiangjiang and Ganjiang as northward Yangtze tributaries", () => {
  ["湘江", "赣江"].forEach((name) => {
    assert.ok(
      hydroBuildScript.includes(`"${name}"`),
      `${name} should be listed in the NAME_TO_ID mapping`
    );
  });
  assert.match(hydroBuildScript, /"湘江":[\s\S]*flowDir:\s*"lat-asc"/);
  assert.match(hydroBuildScript, /"赣江":[\s\S]*flowDir:\s*"lat-asc"/);
  assert.ok(neSource.rivers.some((river) => river.name === "湘江"));
  assert.ok(neSource.rivers.some((river) => river.name === "赣江"));
});

test("hydrography build script maps Haihe basin tributaries for the north expansion", () => {
  ["海河", "漳河"].forEach((name) => {
    assert.ok(
      hydroBuildScript.includes(`"${name}"`),
      `${name} should be listed in the NAME_TO_ID mapping`
    );
  });
  assert.match(hydroBuildScript, /"海河":[\s\S]*flowDir:\s*"lon-asc"/);
  assert.match(hydroBuildScript, /"漳河":[\s\S]*flowDir:\s*"lon-asc"/);
  assert.ok(neSource.rivers.some((river) => river.name === "海河"));
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
