import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

import { Group, Mesh, PlaneGeometry } from "three";

import {
  createLandMaskSamplerFromData,
  createLandMaskGroupFromData,
  landMaskCanvasPoint
} from "../src/game/terrain/landMaskRenderer.ts";

test("land mask renderer turns coastline polygons into a single textured underlay plane", () => {
  const group = createLandMaskGroupFromData({
    schema: "visual-china.land-mask.v1",
    polygons: [
      [
        [
          [120, 31],
          [121, 31],
          [121, 30],
          [120, 30],
          [120, 31]
        ]
      ]
    ]
  });

  assert.ok(group instanceof Group);
  assert.equal(group.children.length, 1);
  const mesh = group.children[0];
  assert.ok(mesh instanceof Mesh);
  assert.ok(mesh.geometry instanceof PlaneGeometry);
  assert.equal(mesh.renderOrder, -6);
  assert.equal(mesh.position.y, -2.92);
});

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
