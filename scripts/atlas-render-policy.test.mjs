import assert from "node:assert/strict";
import test from "node:test";

import {
  atlasCanvasPoint,
  atlasFeatureCenter,
  atlasLayerDrawOrder,
  atlasMinimumDisplayPriority,
  missingDemTileWorldRects,
  parseMissingDemTileNames,
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

test("atlas render policy exposes interpolated DEM tile gaps as map quality areas", () => {
  const notes = [
    "Missing required tiles filled by neighbor interpolation: N32E103_FABDEM_V1-2.tif, N32E104_FABDEM_V1-2.tif."
  ];

  assert.deepEqual(parseMissingDemTileNames(notes), [
    "N32E103_FABDEM_V1-2.tif",
    "N32E104_FABDEM_V1-2.tif"
  ]);

  const rects = missingDemTileWorldRects({
    bounds: { west: 103.5, east: 109, south: 30.4, north: 35.4 },
    world,
    notes
  });

  assert.equal(rects.length, 2);
  assert.equal(rects[0].tileName, "N32E103_FABDEM_V1-2.tif");
  assert.ok(rects[0].minX >= -90, "western missing tile should be clipped to slice bounds");
  assert.ok(rects[0].maxX < rects[1].maxX, "adjacent missing tiles should preserve geography order");
  assert.ok(rects[0].minY < rects[0].maxY, "missing tile rect should have visible north-south span");
});

test("atlas render policy reveals dense evidence layers only when zoomed in", () => {
  assert.equal(atlasMinimumDisplayPriority({ fullscreen: false, scale: 1 }), 7);
  assert.equal(atlasMinimumDisplayPriority({ fullscreen: true, scale: 1 }), 7);
  assert.equal(atlasMinimumDisplayPriority({ fullscreen: true, scale: 2 }), 4);
  assert.equal(atlasMinimumDisplayPriority({ fullscreen: true, scale: 4 }), 4);

  const features = [
    { id: "major", layer: "water", displayPriority: 8 },
    { id: "tributary", layer: "water", displayPriority: 4 },
    { id: "local", layer: "water", displayPriority: 0 }
  ];
  const layers = [{ id: "water", defaultVisible: true }];

  assert.deepEqual(
    atlasVisibleFeatures(features, layers, { minDisplayPriority: 7 }).map((feature) => feature.id),
    ["major"]
  );
  assert.deepEqual(
    atlasVisibleFeatures(features, layers, { minDisplayPriority: 4 }).map((feature) => feature.id),
    ["major", "tributary"]
  );
});
