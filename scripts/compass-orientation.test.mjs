import assert from "node:assert/strict";
import test from "node:test";

import {
  cameraDirectionLabel,
  northNeedleAngleRadians,
  screenRightDirectionLabel
} from "../src/game/compass.js";

function nearlyEqual(actual, expected) {
  assert.ok(
    Math.abs(actual - expected) < 0.000001,
    `expected ${actual} to be approximately ${expected}`
  );
}

// 新 mapOrientation 契约：北 = -Z（与 Three.js 默认相机 forward 对齐）。
// cameraHeading=0 时玩家朝北看（forward = -Z）；cameraHeading=π 时朝南。

test("north needle points upward when the camera looks north (heading=0)", () => {
  nearlyEqual(northNeedleAngleRadians(0), 0);
  assert.equal(cameraDirectionLabel(0), "北");
});

test("north needle points right when the camera looks west (heading=π/2)", () => {
  // 玩家朝西看，北在玩家右手边（人朝西右手指北）→ 屏幕右
  nearlyEqual(northNeedleAngleRadians(Math.PI / 2), Math.PI / 2);
  assert.equal(cameraDirectionLabel(Math.PI / 2), "西");
});

test("north needle points left when the camera looks east (heading=-π/2)", () => {
  // 玩家朝东看，北在玩家左手边 → 屏幕左
  nearlyEqual(northNeedleAngleRadians(-Math.PI / 2), -Math.PI / 2);
  assert.equal(cameraDirectionLabel(-Math.PI / 2), "东");
});

test("default touring view keeps screen right as geographic east", () => {
  // heading=0 玩家朝北时，屏幕右 = 东
  assert.equal(screenRightDirectionLabel(0), "东");
});
