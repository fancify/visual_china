import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Group, Mesh, Object3D, PlaneGeometry, MeshBasicMaterial, PCFSoftShadowMap } from "three";

import {
  applyCastShadowPolicy,
  CAST_SHADOW_NAMES,
  RECEIVE_SHADOW_NAMES
} from "../src/game/castShadowPolicy.ts";

test("cast shadow policy marks only whitelisted names or userData kinds", () => {
  const root = new Group();
  const avatar = new Mesh(new PlaneGeometry(), new MeshBasicMaterial());
  avatar.name = "avatar";
  const cityFloor = new Mesh(new PlaneGeometry(), new MeshBasicMaterial());
  cityFloor.userData.kind = "city-floor";
  const grass = new Mesh(new PlaneGeometry(), new MeshBasicMaterial());
  grass.name = "grass";

  root.add(avatar, cityFloor, grass);
  applyCastShadowPolicy(root);

  assert.equal(avatar.castShadow, true);
  assert.equal(avatar.receiveShadow, false);
  assert.equal(cityFloor.castShadow, false);
  assert.equal(cityFloor.receiveShadow, true);
  assert.equal(grass.castShadow, false);
  assert.equal(grass.receiveShadow, false);
});

test("R8 shadow whitelists include phase-four names without enabling all meshes", () => {
  assert.ok(CAST_SHADOW_NAMES.has("avatar"));
  assert.ok(CAST_SHADOW_NAMES.has("city-wall-instanced"));
  assert.ok(CAST_SHADOW_NAMES.has("scenic-mesh"));
  assert.ok(!CAST_SHADOW_NAMES.has("grass"));
  assert.ok(!CAST_SHADOW_NAMES.has("wildlife"));
  assert.ok(RECEIVE_SHADOW_NAMES.has("terrain-chunk-near"));
});

test("main enables renderer shadow map as PCFSoftShadowMap and leaves casting to Phase 4", async () => {
  const mainSource = await readFile(new URL("../src/main.ts", import.meta.url), "utf8");

  assert.equal(typeof PCFSoftShadowMap, "number");
  assert.match(mainSource, /PCFSoftShadowMap/);
  assert.match(mainSource, /renderer\.shadowMap\.enabled = true;/);
  assert.match(mainSource, /renderer\.shadowMap\.type = PCFSoftShadowMap;/);
  assert.match(mainSource, /TODO: Phase 4 enable shadow casting via applyCastShadowPolicy\(\)/);
});
