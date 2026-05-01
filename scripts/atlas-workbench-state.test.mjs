import assert from "node:assert/strict";
import test from "node:test";

import {
  createAtlasWorkbenchState,
  findAtlasFeatureAtCanvasPoint,
  setAtlasFullscreen,
  selectedAtlasFeature,
  toggleAtlasFullscreen,
  toggleAtlasLayer
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
  assert.equal(state.visibleLayerIds.has("road"), true);
  assert.equal(state.visibleLayerIds.has("military"), false);
  assert.equal(state.isFullscreen, false);
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

test("atlas hit testing selects the nearest visible high-priority feature", () => {
  const state = createAtlasWorkbenchState(qinlingAtlasLayers);
  const feature = findAtlasFeatureAtCanvasPoint(
    qinlingAtlasFeatures,
    state,
    { x: 216, y: 58 },
    world,
    canvas
  );

  assert.equal(feature?.name, "长安");
});

test("atlas hit testing ignores hidden layers", () => {
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
