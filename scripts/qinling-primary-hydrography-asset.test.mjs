import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const asset = JSON.parse(
  await readFile("public/data/regions/qinling/hydrography/primary-modern.json", "utf8")
);

test("Qinling primary hydrography v2 declares reviewed display scope", () => {
  assert.equal(asset.schema, "visual-china.region-hydrography.v2");
  assert.equal(asset.regionId, "qinling");
  assert.equal(asset.eraId, "modern");
  assert.equal(asset.displayScope, "main-rivers-and-primary-tributaries");
  assert.equal(asset.source.name, "primary-modern-qinling");
  assert.ok(asset.notes.some((note) => note.includes("OSM")));
});

test("Qinling primary hydrography v2 includes main rivers and first-order tributaries", () => {
  const names = asset.features.map((feature) => feature.displayName ?? feature.name);

  [
    "渭河",
    "汉江",
    "嘉陵江",
    "泾河",
    "沣河",
    "黑河",
    "涝河",
    "褒河",
    "西汉水",
    "牧马河",
    "湑水河"
  ].forEach((name) => {
    assert.ok(names.includes(name), `missing ${name}`);
  });
});

test("Qinling primary hydrography v2 excludes local canals and tiny waterway noise", () => {
  assert.ok(asset.features.length >= 10);
  assert.ok(asset.features.length <= 18);

  asset.features.forEach((feature) => {
    assert.ok(["river", "stream"].includes(feature.kind));
    assert.ok(feature.rank <= 2, `${feature.name} should be rank 1 or 2`);
    assert.ok(feature.geometry.points.length >= 4, `${feature.name} should be renderable`);
    assert.notEqual(feature.kind, "canal");
    assert.notEqual(feature.terrainRole, "local-ditch");
  });
});

test("Qinling primary hydrography v2 records source aggregation evidence", () => {
  asset.features.forEach((feature) => {
    assert.ok(feature.source.name);
    assert.ok(feature.source.confidence);
    assert.ok(["external-vector", "needs-review"].includes(feature.source.verification));
    assert.ok(Number.isInteger(feature.sourceFeatureCount));
    assert.ok(feature.sourceFeatureCount >= 1);
  });
});

function segmentLengths(points) {
  return points.slice(1).map((point, index) => {
    const previous = points[index];
    return Math.hypot(point.x - previous.x, point.y - previous.y);
  });
}

test("Qinling primary hydrography v2 does not hard-connect disconnected OSM fragments", () => {
  asset.features
    .filter((feature) => feature.source.verification === "external-vector")
    .forEach((feature) => {
    const longestSegment = Math.max(...segmentLengths(feature.geometry.points));

    assert.ok(
      longestSegment <= 12,
      `${feature.name} contains an artificial ${longestSegment.toFixed(1)} world-unit jump`
    );
    });
});

test("Qinling primary hydrography v2 orients known rivers toward their downstream direction", () => {
  // 新 mapOrientation 契约：北 = -Z（即 .y 字段为负值）。
  // 下游方向相对旧约定整体翻 y 符号——河流向南流时 y 增加（+Z 是南）。
  const expectedDirections = new Map([
    ["渭河", { x: 1, y: 0 }],
    ["汉江", { x: 1, y: 0.2 }],
    ["嘉陵江", { x: 0.1, y: 1 }],
    ["泾河", { x: 1, y: 0.6 }],
    ["沣河", { x: 0, y: -1 }],
    ["黑河", { x: 0.4, y: -1 }],
    ["涝河", { x: 0, y: -1 }],
    ["褒河", { x: 0, y: 1 }],
    ["西汉水", { x: 0.6, y: 1 }]
  ]);

  expectedDirections.forEach((direction, name) => {
    const feature = asset.features.find((candidate) => candidate.name === name);

    assert.ok(feature, `missing ${name}`);

    const start = feature.geometry.points[0];
    const end = feature.geometry.points.at(-1);
    const downstreamDot = (end.x - start.x) * direction.x + (end.y - start.y) * direction.y;

    assert.ok(downstreamDot > 0, `${name} is oriented opposite to its expected downstream direction`);
  });
});
