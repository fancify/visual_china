import assert from "node:assert/strict";
import test from "node:test";

import {
  atlasMapCanvasToWorldPoint,
  atlasMapWorldToCanvasPoint,
  createAtlasWorkbenchState,
  findAtlasFeatureAtCanvasPoint,
  panAtlasMap,
  resetAtlasMapView,
  setAtlasFullscreen,
  selectedAtlasFeature,
  toggleAtlasFullscreen,
  toggleAtlasLayer,
  zoomAtlasMapAtPoint
} from "../src/game/atlasWorkbench.js";
import {
  qinlingAtlasFeatures,
  qinlingAtlasLayers
} from "../src/game/qinlingAtlas.js";

const world = { width: 180, depth: 240 };
const canvas = { width: 220, height: 270 };

test("atlas workbench starts with default-visible layers enabled", () => {
  const state = createAtlasWorkbenchState(qinlingAtlasLayers);

  assert.equal(state.visibleLayerIds.has("landform"), true);
  assert.equal(state.visibleLayerIds.has("water"), true);
  assert.equal(state.visibleLayerIds.has("road"), false);
  assert.equal(state.visibleLayerIds.has("city"), false);
  assert.equal(state.visibleLayerIds.has("pass"), false);
  assert.equal(state.visibleLayerIds.has("military"), false);
  assert.equal(state.isFullscreen, false);
  assert.deepEqual(state.mapView, { scale: 1, offsetX: 0, offsetY: 0 });
});

test("atlas workbench toggles optional layers without mutating prior state", () => {
  const state = createAtlasWorkbenchState(qinlingAtlasLayers);
  const next = toggleAtlasLayer(state, "military");

  assert.equal(state.visibleLayerIds.has("military"), false);
  assert.equal(next.visibleLayerIds.has("military"), true);
});

test("atlas workbench keeps landform visible as the base reading layer", () => {
  const state = createAtlasWorkbenchState(qinlingAtlasLayers);
  const next = toggleAtlasLayer(state, "landform");

  assert.equal(next.visibleLayerIds.has("landform"), true);
});

test("atlas selected feature resolves from stable feature id", () => {
  const state = {
    ...createAtlasWorkbenchState(qinlingAtlasLayers),
    selectedFeatureId: "water-weihe"
  };

  assert.equal(selectedAtlasFeature(state, qinlingAtlasFeatures)?.name, "渭河");
});

test("atlas fullscreen mode can be opened, closed, and toggled immutably", () => {
  const state = createAtlasWorkbenchState(qinlingAtlasLayers);
  const opened = setAtlasFullscreen(state, true);
  const closed = toggleAtlasFullscreen(opened);

  assert.equal(state.isFullscreen, false);
  assert.equal(opened.isFullscreen, true);
  assert.equal(closed.isFullscreen, false);
});

test("atlas map zoom keeps the pointer anchored to the same world point", () => {
  const state = createAtlasWorkbenchState(qinlingAtlasLayers);
  const pointer = { x: 150, y: 90 };
  const before = atlasMapCanvasToWorldPoint(pointer, world, canvas, state.mapView);
  const zoomed = zoomAtlasMapAtPoint(state, 2, pointer, world, canvas);
  const after = atlasMapCanvasToWorldPoint(pointer, world, canvas, zoomed.mapView);

  assert.equal(zoomed.mapView.scale, 2);
  assert.equal(Math.abs(before.x - after.x) < 0.000001, true);
  assert.equal(Math.abs(before.y - after.y) < 0.000001, true);
});

test("atlas map pan shifts rendered canvas points without mutating prior state", () => {
  const state = createAtlasWorkbenchState(qinlingAtlasLayers);
  const panned = panAtlasMap(state, { x: 12, y: -8 });
  const original = atlasMapWorldToCanvasPoint({ x: 0, y: 0 }, world, canvas, state.mapView);
  const shifted = atlasMapWorldToCanvasPoint({ x: 0, y: 0 }, world, canvas, panned.mapView);

  assert.deepEqual(state.mapView, { scale: 1, offsetX: 0, offsetY: 0 });
  assert.equal(shifted.x - original.x, 12);
  assert.equal(shifted.y - original.y, -8);
});

test("atlas map reset returns to the full-region view", () => {
  const state = panAtlasMap(
    zoomAtlasMapAtPoint(
      createAtlasWorkbenchState(qinlingAtlasLayers),
      2,
      { x: 150, y: 90 },
      world,
      canvas
    ),
    { x: 12, y: -8 }
  );
  const reset = resetAtlasMapView(state);

  assert.deepEqual(reset.mapView, { scale: 1, offsetX: 0, offsetY: 0 });
});

test("atlas hit testing selects the nearest visible verified feature", () => {
  const state = createAtlasWorkbenchState(qinlingAtlasLayers);
  const features = [
    {
      id: "verified-water-point",
      name: "核验水系点",
      layer: "water",
      geometry: "point",
      world: { x: 0, y: 0 },
      displayPriority: 10,
      source: { verification: "external-vector" }
    }
  ];
  const pointer = atlasMapWorldToCanvasPoint(
    features[0].world,
    world,
    canvas,
    state.mapView
  );
  const feature = findAtlasFeatureAtCanvasPoint(
    features,
    state,
    pointer,
    world,
    canvas
  );

  assert.equal(feature?.name, "核验水系点");
});

test("atlas hit testing ignores unverified hand-drawn features even when their layer is toggled", () => {
  const state = toggleAtlasLayer(createAtlasWorkbenchState(qinlingAtlasLayers), "city");
  const feature = findAtlasFeatureAtCanvasPoint(
    qinlingAtlasFeatures,
    state,
    { x: 216, y: 58 },
    world,
    canvas
  );

  assert.notEqual(feature?.name, "长安");
});

test("atlas hit testing respects zoomed and panned map view", () => {
  const state = panAtlasMap(
    zoomAtlasMapAtPoint(
      createAtlasWorkbenchState(qinlingAtlasLayers),
      2,
      { x: 110, y: 135 },
      world,
      canvas
    ),
    { x: -30, y: 10 }
  );
  const verifiedFeature = {
    id: "verified-water-point",
    name: "核验水系点",
    layer: "water",
    geometry: "point",
    world: { x: 88.04, y: 69.12 },
    displayPriority: 10,
    source: { verification: "external-vector" }
  };
  const pointer = atlasMapWorldToCanvasPoint(
    verifiedFeature.world,
    world,
    canvas,
    state.mapView
  );
  const feature = findAtlasFeatureAtCanvasPoint(
    [verifiedFeature],
    state,
    pointer,
    world,
    canvas
  );

  assert.equal(feature?.name, "核验水系点");
});
