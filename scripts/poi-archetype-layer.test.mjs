import assert from "node:assert/strict";
import test from "node:test";

import {
  poiModelScale,
  poiLabelCanvasWidthForText,
  poiLabelsVisibleByDefault,
  poiLabelVisibleForWorldDistance,
  poiLabelVisibleForCameraAltitude,
  poiLabelWorldHeightForScreenFont,
  poiRedPaintNightGlowIntensity,
  poiRotationY,
  poiVisibleForCameraAltitude
} from "../src/game/terrain/poiArchetypeLayer.ts";

test("POI model scale previews at 6x the latest Line B poi-map-demo scale policy", () => {
  const previewScale = 6;
  assert.equal(poiModelScale({ hierarchy: "small", archetype: "city", size: "small" }), (1 / 15) * previewScale);
  assert.equal(
    poiModelScale({ hierarchy: "medium", archetype: "city", size: "medium" }),
    (1 / 15) * (3 / 5) * 1.2 * previewScale
  );
  assert.equal(
    poiModelScale({ hierarchy: "large", archetype: "city", size: "large" }),
    (1 / 15) * (3 / 8) * 1.2 * 1.2 * previewScale
  );
  assert.equal(
    poiModelScale({ hierarchy: "large", archetype: "mausoleum", variant: "imperial" }),
    ((1 / 15) / 3) * previewScale
  );
  assert.equal(
    poiModelScale({ hierarchy: "medium", archetype: "pass", variant: "minor" }),
    ((1 / 15) / 3) * previewScale
  );
  assert.equal(
    poiModelScale({ hierarchy: "medium", archetype: "cave" }),
    ((1 / 15) / 2) * previewScale
  );
});

test("POI altitude LOD keeps gravity/large visible from high altitude", () => {
  assert.equal(poiVisibleForCameraAltitude({ hierarchy: "gravity" }, 400), true);
  assert.equal(poiVisibleForCameraAltitude({ hierarchy: "large" }, 400), true);
  assert.equal(poiVisibleForCameraAltitude({ hierarchy: "medium" }, 400), false);
  assert.equal(poiVisibleForCameraAltitude({ hierarchy: "small" }, 400), false);
});

test("POI altitude LOD reveals medium and small only near the ground", () => {
  assert.equal(poiVisibleForCameraAltitude({ hierarchy: "medium" }, 80), true);
  assert.equal(poiVisibleForCameraAltitude({ hierarchy: "small" }, 80), false);
  assert.equal(poiVisibleForCameraAltitude({ hierarchy: "small" }, 30), true);
});

test("POI labels remain available outside the L0 terrain band at small screen size", () => {
  assert.equal(poiLabelVisibleForCameraAltitude(59.9), true);
  assert.equal(poiLabelVisibleForCameraAltitude(60), true);
  assert.equal(poiLabelVisibleForCameraAltitude(60.1), true);
  assert.equal(poiLabelVisibleForCameraAltitude(120), true);
});

test("POI labels are hidden by default and POI information is shown through hover", () => {
  assert.equal(poiLabelsVisibleByDefault(), false);
});

test("POI labels clamp to a compact 10-12px screen text range", () => {
  const near = poiLabelWorldHeightForScreenFont({
    distance: 4,
    cameraFovDeg: 60,
    canvasHeightPx: 900
  });
  const far = poiLabelWorldHeightForScreenFont({
    distance: 80,
    cameraFovDeg: 60,
    canvasHeightPx: 900
  });

  assert.equal(near.screenFontPx, 12);
  assert.equal(far.screenFontPx, 10);
  assert.ok(far.worldHeight > near.worldHeight);
});

test("POI labels only show within 50 world units of the camera", () => {
  assert.equal(poiLabelVisibleForWorldDistance(50), true);
  assert.equal(poiLabelVisibleForWorldDistance(50.1), false);
});

test("POI label canvas defaults to three Chinese characters and grows for longer names", () => {
  assert.equal(poiLabelCanvasWidthForText("长安"), poiLabelCanvasWidthForText("大明宫"));
  assert.ok(poiLabelCanvasWidthForText("乾陵陪葬墓群") > poiLabelCanvasWidthForText("大明宫"));
});

test("Tang red wall glow fades in after dusk and fades out before dawn", () => {
  assert.equal(poiRedPaintNightGlowIntensity(12), 0);
  assert.equal(poiRedPaintNightGlowIntensity(18), 0);
  assert.ok(poiRedPaintNightGlowIntensity(19) > 0);
  assert.equal(poiRedPaintNightGlowIntensity(22), 1);
  assert.equal(poiRedPaintNightGlowIntensity(0), 1);
  assert.ok(poiRedPaintNightGlowIntensity(5.8) < 1);
  assert.equal(poiRedPaintNightGlowIntensity(7), 0);
});

test("POI visual rotation preserves model default orientation before applying Line A override", () => {
  assert.equal(poiRotationY(Math.PI, undefined), Math.PI);
  assert.equal(poiRotationY(Math.PI, Math.PI / 2), Math.PI * 1.5);
});
