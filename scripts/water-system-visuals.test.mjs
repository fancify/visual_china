import assert from "node:assert/strict";
import test from "node:test";

import {
  buildWaterRibbonVertices,
  buildRiverVegetationSamples,
  riverCorridorInfluenceAtPoint,
  isRenderableWaterFeature,
  selectRenderableWaterFeatures,
  waterLabelPoint,
  waterEnvironmentVisualStyle,
  waterVisualStyle
} from "../src/game/waterSystemVisuals.js";

const baseWaterFeature = {
  id: "water-test",
  name: "测试河流",
  layer: "water",
  geometry: "polyline",
  world: { points: [{ x: 0, y: 0 }, { x: 10, y: 2 }] },
  displayPriority: 7,
  terrainRole: "main-river",
  themes: ["terrain"],
  copy: { summary: "" },
  visualRule: { symbol: "main-river-line", color: "#5eb8c9", emphasis: "main-river" }
};

test("3D water visuals include curated Qinling skeleton rivers", () => {
  const feature = {
    ...baseWaterFeature,
    source: { name: "curated-modern-qinling", confidence: "medium" }
  };

  assert.equal(isRenderableWaterFeature(feature), true);
});

test("3D water visuals use reviewed primary waterways instead of raw OSM evidence", () => {
  const primaryImported = {
    ...baseWaterFeature,
    id: "primary-water-major",
    displayPriority: 8,
    source: { name: "primary-modern-qinling", verification: "external-vector" }
  };
  const rawImported = {
    ...baseWaterFeature,
    id: "osm-water-major",
    displayPriority: 8,
    source: { name: "openstreetmap-overpass", verification: "external-vector" }
  };
  const minorImported = {
    ...baseWaterFeature,
    id: "osm-water-minor",
    displayPriority: 5,
    source: { name: "openstreetmap-overpass", verification: "external-vector" }
  };

  assert.equal(isRenderableWaterFeature(primaryImported), true);
  assert.equal(isRenderableWaterFeature(rawImported), false);
  assert.equal(isRenderableWaterFeature(minorImported), false);
});

test("3D water visuals sort main rivers first and cap render count", () => {
  const features = Array.from({ length: 6 }, (_, index) => ({
    ...baseWaterFeature,
    id: `water-${index}`,
    displayPriority: index,
    source: { name: "curated-modern-qinling", confidence: "medium" }
  }));

  const selected = selectRenderableWaterFeatures(features, {
    maxFeatures: 3,
    minDisplayPriority: 3
  });

  assert.deepEqual(
    selected.map((feature) => feature.id),
    ["water-5", "water-4", "water-3"]
  );
});

test("3D touring water selection hides first-order tributaries by default", () => {
  const mainRiver = {
    ...baseWaterFeature,
    id: "main-river",
    displayPriority: 10,
    source: { name: "primary-modern-qinling", verification: "external-vector" }
  };
  const primaryTributary = {
    ...baseWaterFeature,
    id: "primary-tributary",
    displayPriority: 8,
    source: { name: "primary-modern-qinling", verification: "external-vector" }
  };

  const selected = selectRenderableWaterFeatures([primaryTributary, mainRiver]);

  assert.deepEqual(selected.map((feature) => feature.id), ["main-river"]);
});

test("water label point chooses a stable interior point on the river", () => {
  const feature = {
    ...baseWaterFeature,
    world: {
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 30, y: 0 },
        { x: 40, y: 0 }
      ]
    }
  };

  assert.deepEqual(waterLabelPoint(feature), { x: 30, y: 0 });
});

test("3D water visuals stay visible as a simple narrow ribbon glued to terrain", () => {
  const majorStyle = waterVisualStyle({ ...baseWaterFeature, displayPriority: 10 });
  const minorStyle = waterVisualStyle({ ...baseWaterFeature, displayPriority: 7 });

  // 简化后：单层 ribbon、贴地、窄。用户反馈"反光奇怪 + 太宽 + 飘空"。
  assert.ok(majorStyle.bankWidth > majorStyle.ribbonWidth);
  assert.ok(majorStyle.bankOpacity > 0.1);
  assert.ok(majorStyle.bankOpacity < majorStyle.ribbonOpacity);
  assert.ok(majorStyle.ribbonWidth >= 0.8);
  assert.ok(majorStyle.ribbonWidth <= 1.2);
  assert.ok(majorStyle.ribbonYOffset >= 0.2);
  assert.ok(majorStyle.ribbonYOffset <= 0.5);
  assert.ok(majorStyle.ribbonOpacity >= 0.85);
  assert.equal(majorStyle.depthTest, true);
  assert.ok(minorStyle.ribbonWidth >= 0.4);
  assert.ok(minorStyle.ribbonWidth <= 0.7);
});

test("water environment style keeps clear daylight rivers readable", () => {
  const baseStyle = waterVisualStyle({ ...baseWaterFeature, displayPriority: 10 });
  const daylight = waterEnvironmentVisualStyle(baseStyle, {
    daylight: 1,
    waterShimmer: 0.8,
    ambientIntensity: 1.7,
    sunIntensity: 2.8,
    moonOpacity: 0,
    fogDensity: 0.003,
    mistOpacity: 0.01,
    precipitationOpacity: 0
  });

  assert.ok(daylight.ribbonOpacity >= baseStyle.ribbonOpacity * 0.9);
  assert.ok(daylight.colorMultiplier >= 0.92);
});

test("water environment style dims river opacity and color at night and in weather", () => {
  const baseStyle = waterVisualStyle({ ...baseWaterFeature, displayPriority: 10 });
  const daylight = waterEnvironmentVisualStyle(baseStyle, {
    daylight: 1,
    waterShimmer: 0.8,
    ambientIntensity: 1.7,
    sunIntensity: 2.8,
    moonOpacity: 0,
    fogDensity: 0.003,
    mistOpacity: 0.01,
    precipitationOpacity: 0
  });
  const rainyNight = waterEnvironmentVisualStyle(baseStyle, {
    daylight: 0,
    waterShimmer: 0.18,
    ambientIntensity: 1.18,
    sunIntensity: 0.04,
    moonOpacity: 0.34,
    fogDensity: 0.009,
    mistOpacity: 0.08,
    precipitationOpacity: 0.6
  });

  assert.ok(rainyNight.ribbonOpacity < daylight.ribbonOpacity * 0.65);
  assert.ok(rainyNight.colorMultiplier < daylight.colorMultiplier * 0.62);
  assert.ok(rainyNight.ribbonOpacity >= baseStyle.ribbonOpacity * 0.28);
});

test("water ribbon vertices keep each cross-section level instead of draping across slopes", () => {
  const vertices = buildWaterRibbonVertices(
    [{ x: 0, y: 0 }, { x: 10, y: 0 }],
    {
      width: 4,
      yOffset: 0.35,
      sampleHeight: (x, z) => x * 0.2 + z
    }
  );

  assert.equal(vertices[1], vertices[4]);
  assert.equal(vertices[7], vertices[13]);
});

test("water ribbon vertices share identical joint positions to avoid broken quads", () => {
  const vertices = buildWaterRibbonVertices(
    [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 12, y: 8 }],
    {
      width: 4,
      yOffset: 0.35,
      sampleHeight: () => 1
    }
  );
  const firstSegmentEndLeft = Array.from(vertices.slice(6, 9));
  const firstSegmentEndRight = Array.from(vertices.slice(12, 15));
  const secondSegmentStartLeft = Array.from(vertices.slice(18, 21));
  const secondSegmentStartRight = Array.from(vertices.slice(21, 24));

  assert.deepEqual(firstSegmentEndLeft, secondSegmentStartLeft);
  assert.deepEqual(firstSegmentEndRight, secondSegmentStartRight);
});

test("river corridor influence identifies water, wet banks, and far dry terrain", () => {
  const feature = {
    ...baseWaterFeature,
    world: { points: [{ x: 0, y: 0 }, { x: 20, y: 0 }] },
    displayPriority: 10,
    source: { name: "primary-modern-qinling", verification: "external-vector" }
  };

  const center = riverCorridorInfluenceAtPoint(8, 0.2, [feature]);
  const bank = riverCorridorInfluenceAtPoint(8, 3.5, [feature]);
  const far = riverCorridorInfluenceAtPoint(8, 14, [feature]);

  assert.ok(center.water > 0.6);
  assert.ok(bank.bank > 0.35);
  assert.ok(bank.vegetation > center.vegetation);
  assert.equal(far.water, 0);
  assert.equal(far.bank, 0);
});

test("river vegetation samples follow both banks and respect the render cap", () => {
  const feature = {
    ...baseWaterFeature,
    world: { points: [{ x: 0, y: 0 }, { x: 40, y: 0 }] },
    displayPriority: 10,
    source: { name: "primary-modern-qinling", verification: "external-vector" }
  };

  const samples = buildRiverVegetationSamples([feature], {
    maxSamples: 8,
    spacing: 4,
    bankOffset: 2.4
  });

  assert.equal(samples.length, 8);
  assert.ok(samples.some((sample) => sample.z > 0));
  assert.ok(samples.some((sample) => sample.z < 0));
  assert.ok(samples.every((sample) => sample.featureId === feature.id));
  assert.ok(samples.every((sample) => sample.scale >= 0.45));
});
