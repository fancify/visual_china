import assert from "node:assert/strict";
import test from "node:test";

import { qinlingCameraRig } from "../src/game/cameraRig.js";
import {
  cameraForwardVector,
  cameraRightVector,
  movementVectorFromInput
} from "../src/game/navigation.js";

function nearlyEqual(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) < 0.000001,
    `expected ${actual} to be approximately ${expected}`
  );
}

test("W moves toward the current camera view direction", () => {
  const heading = Math.PI / 2;
  const forward = cameraForwardVector(heading);
  const movement = movementVectorFromInput({
    heading,
    forward: 1,
    right: 0
  });

  nearlyEqual(movement.x, forward.x);
  nearlyEqual(movement.z, forward.z);
});

test("A/D strafe perpendicular to camera view direction", () => {
  const heading = Math.PI / 2;
  const left = movementVectorFromInput({
    heading,
    forward: 0,
    right: -1
  });
  const right = movementVectorFromInput({
    heading,
    forward: 0,
    right: 1
  });

  nearlyEqual(left.x, 0);
  nearlyEqual(left.z, 1);
  nearlyEqual(right.x, 0);
  nearlyEqual(right.z, -1);
});

test("default touring camera keeps geographic east on the right side of the screen", () => {
  const right = cameraRightVector(qinlingCameraRig.initialHeading);

  assert.ok(right.x > 0.99);
  nearlyEqual(right.z, 0);
});
