import assert from "node:assert/strict";
import test from "node:test";

import { computeAvatarTilt } from "../src/game/avatarTilt.ts";

test("uphill terrain pitches the avatar backward", () => {
  const tilt = computeAvatarTilt({
    position: { x: 0, z: 0 },
    heading: 0,
    sampler: {
      sampleSurfaceHeight(x) {
        return x;
      }
    }
  });

  assert.ok(tilt.pitch < 0);
  assert.equal(tilt.roll, 0);
});

test("higher ground on the avatar right rolls the avatar left", () => {
  const tilt = computeAvatarTilt({
    position: { x: 0, z: 0 },
    heading: 0,
    sampler: {
      sampleSurfaceHeight(_x, z) {
        return z;
      }
    }
  });

  assert.ok(Math.abs(tilt.pitch) < 1e-9);
  assert.ok(tilt.roll < 0);
});

test("tilt clamps to thirty degrees on extreme slopes", () => {
  const tilt = computeAvatarTilt({
    position: { x: 0, z: 0 },
    heading: 0,
    sampler: {
      sampleSurfaceHeight(x) {
        return x * 100;
      }
    }
  });

  assert.equal(tilt.pitch, -Math.PI / 6);
  assert.equal(tilt.roll, 0);
});
