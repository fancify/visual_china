import assert from "node:assert/strict";
import test from "node:test";

import {
  cameraAlignedCanvasToWorldPoint,
  cameraAlignedWorldToCanvasPoint
} from "../src/game/cameraMapProjection.js";

const world = { width: 180, depth: 240 };
const canvas = { width: 220, height: 270 };

function nearlyEqual(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) < 0.000001,
    `expected ${actual} to be approximately ${expected}`
  );
}

test("camera-aligned mini map mirrors east/west when the 3D camera looks north", () => {
  const heading = Math.PI;
  const east = cameraAlignedWorldToCanvasPoint(
    { x: 70, y: 0 },
    world,
    canvas,
    heading
  );
  const west = cameraAlignedWorldToCanvasPoint(
    { x: -70, y: 0 },
    world,
    canvas,
    heading
  );
  const north = cameraAlignedWorldToCanvasPoint(
    { x: 0, y: 90 },
    world,
    canvas,
    heading
  );
  const south = cameraAlignedWorldToCanvasPoint(
    { x: 0, y: -90 },
    world,
    canvas,
    heading
  );

  assert.ok(east.x < west.x);
  assert.ok(north.y < south.y);
});

test("camera-aligned mini map round-trips canvas and world points", () => {
  const heading = Math.PI * 0.74;
  const worldPoint = { x: 32, y: -48 };
  const canvasPoint = cameraAlignedWorldToCanvasPoint(
    worldPoint,
    world,
    canvas,
    heading
  );
  const roundTrip = cameraAlignedCanvasToWorldPoint(
    canvasPoint,
    world,
    canvas,
    heading
  );

  nearlyEqual(roundTrip.x, worldPoint.x);
  nearlyEqual(roundTrip.y, worldPoint.y);
});
