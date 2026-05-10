import assert from "node:assert/strict";
import test from "node:test";
import { Object3D } from "three";

import { GroundAnchorRegistry } from "../src/game/groundAnchors.ts";

function makeSampler(heightFn = (x, z) => x + z) {
  return {
    sampleSurfaceHeight(x, z) {
      return heightFn(x, z);
    }
  };
}

test("GroundAnchorRegistry registers, reanchors, and unregisters objects", () => {
  const registry = new GroundAnchorRegistry();
  const object = new Object3D();

  registry.register("city:xian", {
    object,
    worldX: 2,
    worldZ: 3,
    baseOffset: 0.5,
    category: "city"
  });
  registry.reanchorAll(makeSampler());
  assert.equal(object.position.y, 5.5);

  registry.unregister("city:xian");
  registry.reanchorAll(makeSampler(() => 20));
  assert.equal(object.position.y, 5.5);
});

test("GroundAnchorRegistry reanchor handles empty chunk bounds", () => {
  const registry = new GroundAnchorRegistry();

  assert.doesNotThrow(() => {
    registry.reanchor(makeSampler(), { minX: 10, maxX: 20, minZ: 10, maxZ: 20 });
  });
});

test("GroundAnchorRegistry uses half-open chunk bounds with inclusive outer fallback", () => {
  const registry = new GroundAnchorRegistry();
  const west = new Object3D();
  const east = new Object3D();

  registry.register("west-edge", {
    object: west,
    worldX: 0,
    worldZ: 0,
    baseOffset: 1,
    category: "scenic"
  });
  registry.register("east-inner", {
    object: east,
    worldX: 0.5,
    worldZ: 0,
    baseOffset: 2,
    category: "ancient"
  });

  registry.reanchor(makeSampler(() => 8), { minX: -10, maxX: 0, minZ: -5, maxZ: 5 });
  assert.equal(west.position.y, 0);
  assert.equal(east.position.y, 0);

  registry.reanchor(makeSampler(() => 8), { minX: 0, maxX: 10, minZ: -5, maxZ: 5 });
  assert.equal(west.position.y, 9);
  assert.equal(east.position.y, 10);

  registry.reanchor(makeSampler(() => 12), { minX: 0, maxX: 0, minZ: -5, maxZ: 5 });
  assert.equal(west.position.y, 13);
});

test("GroundAnchorRegistry invokes custom reanchor callbacks instead of default y update", () => {
  const registry = new GroundAnchorRegistry();
  const object = new Object3D();
  let calls = 0;

  registry.register("path:deck", {
    object,
    worldX: 1,
    worldZ: 1,
    baseOffset: 0,
    category: "path",
    customReanchor(sampler) {
      calls += sampler.sampleSurfaceHeight(1, 1);
    }
  });

  registry.reanchorAll(makeSampler(() => 4));
  assert.equal(calls, 4);
  assert.equal(object.position.y, 0);
});

test("GroundAnchorRegistry invokes custom callbacks for chunk-scoped reanchors", () => {
  const registry = new GroundAnchorRegistry();
  const object = new Object3D();
  let calls = 0;

  registry.register("path:deck", {
    object,
    worldX: 999,
    worldZ: 999,
    baseOffset: 0,
    category: "path",
    customReanchor() {
      calls += 1;
    }
  });

  registry.reanchor(makeSampler(), { minX: 0, maxX: 5, minZ: 0, maxZ: 5 });
  assert.equal(calls, 1);
});

test("GroundAnchorRegistry reanchors multiple anchors in the same chunk", () => {
  const registry = new GroundAnchorRegistry();
  const first = new Object3D();
  const second = new Object3D();

  registry.register("label:a", {
    object: first,
    worldX: 1,
    worldZ: 2,
    baseOffset: 6,
    category: "label"
  });
  registry.register("label:b", {
    object: second,
    worldX: 2,
    worldZ: 3,
    baseOffset: 7,
    category: "label"
  });

  registry.reanchor(makeSampler((x, z) => x * 2 + z), {
    minX: 0,
    maxX: 5,
    minZ: 0,
    maxZ: 5
  });

  assert.equal(first.position.y, 10);
  assert.equal(second.position.y, 14);
});
