import assert from "node:assert/strict";
import test from "node:test";
import { PerspectiveCamera, Vector3 } from "three";

import {
  effectiveCameraHeadingForMode,
  cameraLookTargetForMode,
  cameraPositionForMode,
  overviewScreenAxes
} from "../src/game/cameraView.js";

function projectDelta({ mode, heading = 0, east = true }) {
  const lookTarget = { x: 0, y: 8, z: 0 };
  const position = cameraPositionForMode({
    mode,
    lookTarget,
    heading,
    elevation: 1.02,
    distance: 118
  });
  const camera = new PerspectiveCamera(60, 1, 0.1, 1000);
  camera.position.set(position.x, position.y, position.z);
  camera.up.set(0, mode === "overview" ? 0 : 1, mode === "overview" ? -1 : 0);
  camera.lookAt(new Vector3(lookTarget.x, lookTarget.y, lookTarget.z));
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();

  const center = new Vector3(0, 8, 0).project(camera);
  const point = east
    ? new Vector3(10, 8, 0).project(camera)
    : new Vector3(0, 8, 10).project(camera);

  return {
    x: point.x - center.x,
    y: point.y - center.y
  };
}

test("overview camera now looks at the player so the player stays centered", () => {
  // 之前 overview 锁定看 (0, 8, 0) 让玩家偏到屏幕一角；新设计跟随 player。
  const target = cameraLookTargetForMode({
    mode: "overview",
    player: { x: 12, y: 3, z: 90 },
    lookAtHeight: 2.9
  });

  assert.deepEqual(target, { x: 12, y: 5.9, z: 90 });
});

test("follow camera looks at the player with configured headroom", () => {
  const target = cameraLookTargetForMode({
    mode: "follow",
    player: { x: 12, y: 3, z: 90 },
    lookAtHeight: 2.9
  });

  assert.deepEqual(target, { x: 12, y: 5.9, z: 90 });
});

test("overview camera reuses the follow camera pose to keep east on screen right", () => {
  // overview 不再纯俯视——退化成"follow + 大 distance + 大 elevation"。
  // 这是右手坐标系下唯一能保 east-right + 不出现 east-west 镜像的设计；
  // 代价是 north 不在屏幕几何上方而在远处（heading=0 时屏幕远处=南）。
  const target = { x: 0, y: 8, z: 0 };
  const position = cameraPositionForMode({
    mode: "overview",
    lookTarget: target,
    heading: 0,
    elevation: 1.02,
    distance: 118
  });

  const horizontal = Math.cos(1.02) * 118;
  const vertical = Math.sin(1.02) * 118;
  assert.equal(position.x, target.x);
  assert.ok(Math.abs(position.y - (target.y + vertical)) < 1e-6);
  assert.ok(Math.abs(position.z - (target.z + horizontal)) < 1e-6);

  assert.deepEqual(overviewScreenAxes(), {
    right: { x: 1, z: 0 },
    up: { x: 0, z: 1 }
  });
});

test("actual overview camera projection puts geographic east on screen right", () => {
  const eastDelta = projectDelta({ mode: "overview", east: true });

  assert.ok(eastDelta.x > 0, "east must project to the visual right in overview");
});

test("actual follow camera projection puts geographic east on screen right at default heading", () => {
  const eastDelta = projectDelta({ mode: "follow", heading: 0, east: true });

  assert.ok(eastDelta.x > 0, "east must project to the visual right in follow mode");
});

test("overview camera ignores rotated heading (stays bird's eye)", () => {
  assert.equal(
    effectiveCameraHeadingForMode({ mode: "overview", heading: Math.PI }),
    0
  );
});

test("follow camera honors player-controlled heading (Q/E and mouse drag)", () => {
  // Follow 模式下 cameraHeading 生效——玩家可以绕自己 360 度旋转相机。
  // 之前这里返回 0 把 heading 丢弃，是导致 Q/E 和拖鼠标失效的根因。
  assert.equal(
    effectiveCameraHeadingForMode({ mode: "follow", heading: Math.PI }),
    Math.PI
  );
  assert.equal(
    effectiveCameraHeadingForMode({ mode: "follow", heading: Math.PI / 2 }),
    Math.PI / 2
  );
});
