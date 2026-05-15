import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  characterInputFromKeySet,
  characterPlayerScaleDefaults,
  cameraFollowPoseForCharacterPlayer,
  clampFlightHeightAboveGround,
  MODEL_FORWARD_YAW_OFFSET
} from "../src/game/player/characterRuntime.ts";
import {
  createCharacterController
} from "../src/game/skeletal/CharacterController.ts";
import {
  createFlightController,
  cycleTravelMode
} from "../src/game/skeletal/FlightModes.ts";
import {
  resolveTravelAnimationMode
} from "../src/game/skeletal/flightAnimationMode.ts";
import {
  createCloudFlightVisual,
  createSwordFlightVisual,
  SWORD_TRANSFORM
} from "../src/game/skeletal/flightVisuals.ts";
import {
  resolveCharacterAsset
} from "../src/game/skeletal/characterAssets.ts";

test("Line C skeletal modules expose the stable Line A integration contract", async () => {
  const source = await readFile(
    new URL("../src/game/skeletal/SkeletalCharacter.ts", import.meta.url),
    "utf8"
  );

  assert.match(source, /getFootYOffset\(\)/);
  assert.equal(cycleTravelMode("ground"), "sword");
  assert.equal(cycleTravelMode("sword"), "cloud");
  assert.equal(cycleTravelMode("cloud"), "ground");
  assert.equal(resolveTravelAnimationMode("sword", "run", true), "idle");
  assert.equal(resolveTravelAnimationMode("cloud", "walk", false), "idle");
  assert.equal(typeof SWORD_TRANSFORM.scale, "number");
  assert.equal(createSwordFlightVisual().name, "sword-flight-visual");
  assert.equal(createCloudFlightVisual().name, "cloud-flight-visual");

  const asset = resolveCharacterAsset("");
  assert.match(asset.url, /Meshy_AI_Meshy_Merged_Animations\.glb$/);
  assert.ok(asset.heightMeters > 0);
});

test("Line A character input adapter preserves weather keys and uses Alt digits for clip debug", () => {
  const input = characterInputFromKeySet(new Set(["w", "shift", "space", "alt+4"]));

  assert.equal(input.forward, true);
  assert.equal(input.shift, true);
  assert.equal(input.ascend, true);
  assert.equal(input.directClipDigit, 4);
  assert.equal(characterInputFromKeySet(new Set(["1"])).directClipDigit, null);
});

test("Line A character and flight controllers can share the terrain sampler contract", () => {
  const sampler = { sampleSurfaceHeight: (x, z) => x * 0.1 - z * 0.05 };
  const controller = createCharacterController({
    sampler,
    initialPosition: { x: 2, z: 4 },
    walkSpeed: 1,
    runSpeed: 2
  });

  assert.equal(controller.position.y, sampler.sampleSurfaceHeight(2, 4));
  controller.update(1, characterInputFromKeySet(new Set(["w"])), 0);
  assert.ok(controller.position.x > 2);
  assert.equal(controller.position.y, sampler.sampleSurfaceHeight(controller.position.x, controller.position.z));

  const flight = createFlightController({ initialPosition: { x: 0, y: 3, z: 0 } });
  flight.setMode("cloud", 1);
  flight.update(1, characterInputFromKeySet(new Set(["w", "space"])), 0);
  assert.ok(flight.position.y > 3);
});

test("Line A flight height clamps above terrain while ground mode remains terrain-following", () => {
  const scale = characterPlayerScaleDefaults();

  assert.equal(scale.characterHeight, 0.6);
  assert.equal(scale.walkSpeed, 1.8);
  assert.equal(scale.runSpeed, 3.2);
  assert.equal(scale.swordMinClearance, 8);
  assert.equal(scale.swordMaxClearance, 24);
  assert.equal(scale.cloudMinClearance, 20);
  assert.equal(scale.cloudMaxClearance, 72);
  assert.equal(scale.verticalSpeed, 12);
  assert.ok(scale.cloudMaxClearance > scale.swordMaxClearance);
  assert.equal(MODEL_FORWARD_YAW_OFFSET, Math.PI / 2);
  assert.equal(clampFlightHeightAboveGround(100, 8, "sword", scale), 32);
  assert.equal(clampFlightHeightAboveGround(9, 8, "sword", scale), 16);
  assert.equal(clampFlightHeightAboveGround(100, 8, "cloud", scale), 80);
});

// 2026-05-15: camera follow pose 解耦更新
//   - 旧契约: cameraYaw 被忽略；相机永远 strict-follow heading
//   - 新契约: 相机方位 = heading + cameraYaw；鼠标拖动改 cameraYaw 但不动 heading
test("camera follow pose 默认（cameraYaw=0）在角色身后", () => {
  const pose = cameraFollowPoseForCharacterPlayer({
    target: { x: 10, y: 2, z: -3 },
    heading: 0,
    cameraYaw: 0,
    cameraPitch: 0.35,
    distance: 18
  });

  assert.ok(pose.position.x < 10, "相机在角色 -X 侧（heading=0 的身后）");
  assert.ok(pose.position.y > 2, "相机比角色高");
  assert.equal(pose.lookAt.x, 10, "lookAt 锁角色 x");
  assert.ok(pose.lookAt.y > 2, "lookAt 比角色脚高");
});

test("camera follow pose: cameraYaw 把相机绕角色 orbit（heading 不变）", () => {
  // heading=0, cameraYaw=π/2 → 镜头方位 azimuth=π/2 → 相机在 +Z 侧
  const pose = cameraFollowPoseForCharacterPlayer({
    target: { x: 10, y: 2, z: -3 },
    heading: 0,
    cameraYaw: Math.PI / 2,
    cameraPitch: 0.35,
    distance: 18
  });
  assert.ok(Math.abs(pose.position.x - 10) < 1e-6, "x 不变");
  assert.ok(pose.position.z > -3, "z 变到 +Z 侧");
});

test("camera follow pose: heading 转动时相机跟随（cameraYaw=0）", () => {
  const pose = cameraFollowPoseForCharacterPlayer({
    target: { x: 10, y: 2, z: -3 },
    heading: Math.PI / 2,
    cameraYaw: 0,
    cameraPitch: 0.35,
    distance: 18
  });

  assert.ok(Math.abs(pose.position.x - 10) < 1e-6);
  assert.ok(pose.position.z > -3);
});

test("flight mode keeps absolute altitude while moving over changing terrain", async () => {
  const source = await readFile(
    new URL("../src/game/player/characterRuntime.ts", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(
    source,
    /flightController\.update\(dt, input, cameraYaw\);\s*const groundY = options\.sampler\.sampleSurfaceHeight/
  );
});

test("cloud flight visual writes depth so it can occlude rivers and water", () => {
  const cloud = createCloudFlightVisual();
  const sprite = cloud.children.find((child) => child.name === "cloud-seat-layer");
  assert.ok(sprite);
  assert.equal(sprite.material.depthWrite, true);
  assert.ok(sprite.renderOrder > 20);
});
