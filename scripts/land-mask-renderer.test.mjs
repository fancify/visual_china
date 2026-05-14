import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import {
  createLandMaskSamplerFromData,
  landMaskCanvasPoint
} from "../src/game/terrain/landMaskRenderer.ts";

test("land mask canvas projection maps geographic bounds to texture corners", () => {
  assert.deepEqual(landMaskCanvasPoint(73, 53, 1000, 500), [0, 0]);
  assert.deepEqual(landMaskCanvasPoint(135, 18, 1000, 500), [1000, 500]);
  assert.deepEqual(landMaskCanvasPoint(104, 35.5, 1000, 500), [500, 250]);
});

test("land mask sampler preserves sub-canvas-pixel coastline detail", () => {
  const sampler = createLandMaskSamplerFromData({
    schema: "visual-china.land-mask.v1",
    polygons: [
      [
        [
          [120.0000, 30.0000],
          [120.0010, 30.0000],
          [120.0010, 30.0100],
          [120.0000, 30.0100],
          [120.0000, 30.0000]
        ]
      ]
    ]
  });

  assert.ok(sampler);
  assert.equal(sampler.isLand(120.0005, 30.005), true);
  assert.equal(sampler.isLand(120.0040, 30.005), false);
});

test("pyramid demo uses land mask for clipping, not as a visible coastal underlay", () => {
  const source = fs.readFileSync(new URL("../src/pyramid-demo.ts", import.meta.url), "utf8");
  assert.match(source, /createLandMaskSamplerFromData/);
  assert.doesNotMatch(source, /scene\.add\(landMask\)/);
});

test("land mask module no longer exports the retired visible underlay renderer", () => {
  const source = fs.readFileSync(new URL("../src/game/terrain/index.ts", import.meta.url), "utf8");
  const moduleSource = fs.readFileSync(
    new URL("../src/game/terrain/landMaskRenderer.ts", import.meta.url),
    "utf8"
  );

  assert.doesNotMatch(source, /createLandMaskGroupFromData/);
  assert.doesNotMatch(source, /createLandMaskRenderer/);
  assert.doesNotMatch(moduleSource, /MeshBasicMaterial|CanvasTexture|PlaneGeometry/);
});

test("DEM pyramid build imports a script-safe land mask sampler, not local TS stubs", () => {
  const source = fs.readFileSync(new URL("../scripts/build-dem-pyramid.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /src\/game\/terrain\/landMaskRenderer\.js/);
  assert.match(source, /scripts\/land-mask-sampler\.mjs|\.\/land-mask-sampler\.mjs/);
});
