export function cameraLookTargetForMode({ mode, player, lookAtHeight }) {
  // overview 也以玩家为中心，避免相机俯视时玩家偏在屏幕一角。
  return {
    x: player.x,
    y: player.y + lookAtHeight,
    z: player.z
  };
}

/**
 * 把玩家可控的 cameraHeading 翻译成"当前模式实际生效的 heading"。
 *
 * - `overview` 模式：相机在 lookTarget 正上方俯视，没有"水平朝向"概念，
 *   永远返回 0（cameraPositionForMode 在 overview 下也忽略 heading）。
 * - `follow` 模式：玩家按 Q/E 或拖鼠标转动 cameraHeading，相机绕玩家
 *   水平旋转——所以直接返回传入的 heading。这同时影响 WASD 的世界方向。
 *
 * 历史 bug：之前这里两条分支都 `return 0`，把 cameraHeading 完全丢弃，
 * 导致 Q/E、鼠标拖动、罗盘指示全部失效。
 */
export function effectiveCameraHeadingForMode({ mode, heading = 0 }) {
  if (mode === "overview") {
    return 0;
  }

  return heading;
}

export function cameraPositionForMode({
  mode,
  lookTarget,
  heading,
  elevation,
  distance
}) {
  // 不再为 overview 走特殊路径：overview 等同于 "follow + 大 distance + 大 elevation"。
  // 历史教训：俯视相机在右手系下 east-right 和 north-up 不能同时成立。
  // 以前用 camera.up=(0,0,-1) 强行 north-up 会让南方在屏幕上方；后来又试图
  // 在 lookTarget 南方俯视北方，又导致 east-west 镜像。最干净的解决是：
  // overview 也是斜俯视，远处 = 屏幕远端（near vsync 北南由玩家朝向决定），
  // east-right 永远成立——和 follow 一致。
  const horizontalDistance = Math.cos(elevation) * distance;
  const verticalDistance = Math.sin(elevation) * distance;

  return {
    x: lookTarget.x + Math.sin(heading) * horizontalDistance,
    y: lookTarget.y + verticalDistance,
    z: lookTarget.z + Math.cos(heading) * horizontalDistance
  };
}

export function overviewScreenAxes() {
  return {
    right: { x: 1, z: 0 },
    up: { x: 0, z: 1 }
  };
}
