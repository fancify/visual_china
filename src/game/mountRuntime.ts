import type { MountId } from "./mounts.js";

export const PLAYER_VISUAL_SCALE = 2 / 3;

const MOUNT_SPEED_MULTIPLIER: Record<MountId, number> = {
  none: 0.5,
  horse: 1.6,
  ox: 0.6,
  sheep: 1,
  donkey: 0.85,
  fox: 1.2,
  pig: 0.7,
  // 筋斗云 4.0 → 2.7（降 1/3），仍最快档但不夸张离谱。
  cloud: 2.7,
  // 御剑：飞行型，跟筋斗云同档；但剑更"利"，给一点速度上限提升。
  sword: 3.0,
  chicken: 1.1,
  boar: 0.9
};

export function mountSpeedMultiplier(id: MountId): number {
  return MOUNT_SPEED_MULTIPLIER[id];
}

export function mountInertiaFactor(id: MountId): number {
  if (id === "cloud" || id === "sword") {
    return 0.04;
  }
  if (id === "horse") {
    return 0.12;
  }
  if (id === "none") {
    return 0.3;
  }
  return 0.18;
}

function lerp(start: number, end: number, alpha: number): number {
  return start + (end - start) * alpha;
}

export function advanceMountVelocityScale({
  currentScale,
  targetScale,
  mountId
}: {
  currentScale: number;
  targetScale: number;
  mountId: MountId;
}): number {
  return lerp(currentScale, targetScale, mountInertiaFactor(mountId));
}
