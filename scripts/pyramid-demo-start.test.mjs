import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source = fs.readFileSync("src/pyramid-demo.ts", "utf8");

test("pyramid demo starts at Tang Chang'an instead of modern Beijing", () => {
  assert.match(source, /const CHANGAN_START_GEO = \{\s*lat: 34\.27,\s*lon: 108\.95\s*\};/);
  assert.doesNotMatch(source, /BEIJING_START_GEO/);
  assert.match(source, /projectGeoToWorld\(\s*CHANGAN_START_GEO,/);
});

test("pyramid demo initial camera uses the same near follow state as F reset", () => {
  assert.match(source, /let cameraDistanceOverride: number \| null = CLOSE_CAMERA_DISTANCE;/);
  assert.match(source, /cameraAzimuth = characterHeading;/);
  assert.match(source, /cameraPitch = DEFAULT_CAMERA_PITCH;/);
});
