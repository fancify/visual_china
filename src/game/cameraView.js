export function cameraLookTargetForMode({ mode, player, lookAtHeight }) {
  if (mode === "overview") {
    return { x: 0, y: 8, z: 0 };
  }

  return {
    x: player.x,
    y: player.y + lookAtHeight,
    z: player.z
  };
}
