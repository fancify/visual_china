import assert from "node:assert/strict";
import test from "node:test";

import {
  atlasCanvasPoint,
  atlasFeatureCenter,
  atlasLayerDrawOrder,
  atlasVisibleFeatures,
  worldPointToOverviewPixel
} from "../src/game/atlasRender.js";
import {
  qinlingAtlasFeatures,
  qinlingAtlasLayers
} from "../src/game/qinlingAtlas.js";

const world = { width: 180, depth: 240 };

test("atlas render policy keeps the default overview readable", () => {
  const visible = atlasVisibleFeatures(qinlingAtlasFeatures, qinlingAtlasLayers);
  const visibleLayers = new Set(visible.map((feature) => feature.layer));

  assert.ok(visibleLayers.has("landform"));
  assert.ok(visibleLayers.has("water"));
  assert.ok(visibleLayers.has("road"));
  assert.ok(visibleLayers.has("city"));
  assert.ok(visibleLayers.has("pass"));
  assert.ok(!visibleLayers.has("culture"));
  assert.ok(!visibleLayers.has("military"));
  assert.ok(!visibleLayers.has("livelihood"));
});

test("atlas render order puts landform under water, road, and point labels", () => {
  assert.deepEqual(atlasLayerDrawOrder.slice(0, 5), [
    "landform",
    "water",
    "road",
    "city",
    "pass"
  ]);
});

test("world points convert to overview pixels without changing geographic proportions", () => {
  assert.deepEqual(
    worldPointToOverviewPixel({ x: -90, y: 120 }, world, { width: 220, height: 270 }),
    { x: 0, y: 0 }
  );
  assert.deepEqual(
    worldPointToOverviewPixel({ x: 90, y: -120 }, world, { width: 220, height: 270 }),
    { x: 220, y: 270 }
  );
});

test("atlas canvas points clamp out-of-bounds features to the overview frame", () => {
  assert.deepEqual(
    atlasCanvasPoint(
      { x: 120, y: -160 },
      world,
      { width: 220, height: 270 }
    ),
    { x: 220, y: 270 }
  );
});

test("atlas feature center uses the average of rendered world points", () => {
  const center = atlasFeatureCenter(
    {
      world: {
        points: [
          { x: -90, y: 120 },
          { x: 90, y: -120 }
        ]
      }
    },
    world,
    { width: 220, height: 270 }
  );

  assert.deepEqual(center, { x: 110, y: 135 });
});
