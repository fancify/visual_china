import assert from "node:assert/strict";
import test from "node:test";

import { Color, InstancedMesh, Matrix4, Quaternion, Vector3 } from "three";

import { qinlingRuntimeBudget } from "../src/game/performanceBudget.ts";
import {
  createChunkScenery,
  seasonalLeafStyle,
  updateSceneryColors
} from "../src/game/scenery.ts";

function makeFlatScenerySampler({
  normalizedHeight,
  slope = 0,
  river = 0.9,
  width = 36,
  depth = 36,
  bounds
}) {
  return {
    asset: {
      minHeight: 0,
      maxHeight: 1,
      world: { width, depth },
      grid: { columns: 2, rows: 2 },
      bounds,
      presentation: undefined,
      worldBounds: undefined
    },
    sampleHeight() {
      return normalizedHeight;
    },
    sampleSurfaceHeight() {
      return normalizedHeight;
    },
    sampleSlope() {
      return slope;
    },
    sampleRiver() {
      return river;
    }
  };
}

function requireInstancedMesh(group, role, kind) {
  const mesh = group.children.find(
    (child) =>
      child instanceof InstancedMesh &&
      child.userData.role === role &&
      (kind === undefined || child.userData.kind === kind)
  );
  assert.ok(mesh instanceof InstancedMesh, `expected ${kind ?? "any"} ${role} instanced mesh`);
  return mesh;
}

function collectInstanceColors(mesh) {
  const colors = [];
  for (let index = 0; index < mesh.count; index += 1) {
    const color = new Color();
    mesh.getColorAt(index, color);
    colors.push(color);
  }
  return colors;
}

function collectScaleY(mesh) {
  const matrix = new Matrix4();
  const position = new Vector3();
  const quaternion = new Quaternion();
  const scale = new Vector3();
  const values = [];

  for (let index = 0; index < mesh.count; index += 1) {
    mesh.getMatrixAt(index, matrix);
    matrix.decompose(position, quaternion, scale);
    values.push(scale.y);
  }

  return values;
}

function hasApproxColor(colors, targetHex, epsilon = 0.015) {
  const target = new Color(targetHex);
  return colors.some((color) => colorDistance(color, target) <= epsilon);
}

function colorDistance(a, b) {
  return Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
}

test("seasonalLeafStyle warms northern autumn canopies and raises cold-winter bare chance", () => {
  const southAutumn = seasonalLeafStyle("autumn", 25);
  const northAutumn = seasonalLeafStyle("autumn", 35);
  const northWinter = seasonalLeafStyle("winter", 35);
  const southWinter = seasonalLeafStyle("winter", 25);

  assert.ok(new Color(northAutumn.leafColor).r > new Color(northAutumn.leafColor).g);
  assert.ok(new Color(southAutumn.leafColor).g > new Color(northAutumn.leafColor).g);
  assert.ok(northWinter.bareChance > 0.4);
  assert.ok(northWinter.bareChance > southWinter.bareChance);
});

test("spring at subtropical latitudes still blooms", () => {
  const springStyle = seasonalLeafStyle("spring", 25);

  assert.ok(springStyle.bloomChance > 0);
  assert.equal(springStyle.bareChance, 0);
});

test("winter at subtropical latitudes keeps evergreen bare chance low", () => {
  const winterStyle = seasonalLeafStyle("winter", 25);

  assert.ok(winterStyle.bareChance < 0.15);
});

test("winter at Guanzhong latitudes keeps higher deciduous bare chance", () => {
  const winterStyle = seasonalLeafStyle("winter", 35);

  assert.ok(winterStyle.bareChance > 0.4);
});

test("spring broadleaf scenery blooms and winter recolor bares northern canopies in place", () => {
  const scenery = createChunkScenery(
    makeFlatScenerySampler({
      normalizedHeight: 0.18,
      slope: 0.08,
      river: 0.18,
      bounds: { west: 106, east: 108, south: 34.8, north: 35.2 }
    }),
    qinlingRuntimeBudget.scenery,
    undefined,
    "spring"
  );
  const leafMesh = requireInstancedMesh(scenery, "leaf", "broadleaf");
  const springLeafColors = collectInstanceColors(leafMesh);
  const springLeafScales = collectScaleY(leafMesh);
  const springStyle = seasonalLeafStyle("spring", 35);
  const springBloomColor = new Color(springStyle.leafColor).lerp(
    new Color(springStyle.bloomColor),
    0.6
  );

  assert.ok(leafMesh.count > 0, "expected at least one broadleaf instance in test chunk");
  assert.ok(
    springLeafColors.some((color) => colorDistance(color, springBloomColor) <= 0.015),
    "spring broadleaf canopy should include some blooming trees"
  );

  updateSceneryColors(scenery, "winter");

  const winterLeafColors = collectInstanceColors(leafMesh);
  const winterLeafScales = collectScaleY(leafMesh);
  const winterStyle = seasonalLeafStyle("winter", 35);

  assert.ok(
    hasApproxColor(winterLeafColors, winterStyle.trunkColor),
    "winter northern canopy should mark some trees as bare"
  );
  assert.ok(
    winterLeafScales.some((scaleY, index) => scaleY < springLeafScales[index]),
    "winter bare trees should shrink leaf canopy matrices in place"
  );
});

test("autumn northern broadleaf canopies skew redder than southern lowland broadleaf", () => {
  const northScenery = createChunkScenery(
    makeFlatScenerySampler({
      normalizedHeight: 0.18,
      slope: 0.08,
      river: 0.18,
      bounds: { west: 106, east: 108, south: 34.8, north: 35.2 }
    }),
    qinlingRuntimeBudget.scenery,
    undefined,
    "autumn"
  );
  const southScenery = createChunkScenery(
    makeFlatScenerySampler({
      normalizedHeight: 0.18,
      slope: 0.08,
      river: 0.18,
      bounds: { west: 112, east: 114, south: 24.8, north: 25.2 }
    }),
    qinlingRuntimeBudget.scenery,
    undefined,
    "autumn"
  );

  const northColors = collectInstanceColors(requireInstancedMesh(northScenery, "leaf", "broadleaf"));
  const southColors = collectInstanceColors(requireInstancedMesh(southScenery, "leaf", "broadleaf"));

  assert.ok(northColors.length > 0);
  assert.ok(southColors.length > 0);
  assert.ok(averageChannel(northColors, "r") > averageChannel(southColors, "r"));
});

function averageChannel(colors, channel) {
  return colors.reduce((sum, color) => sum + color[channel], 0) / Math.max(1, colors.length);
}
