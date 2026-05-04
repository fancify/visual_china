import type { MountId } from "./mounts.js";

export const PLAYER_VISUAL_SCALE = 2 / 3;

const MOUNT_SPEED_MULTIPLIER: Record<MountId | "none", number> = {
  none: 1,
  horse: 1.2,
  ox: 0.6,
  sheep: 1.05,
  donkey: 0.95,
  fox: 1.1,
  pig: 0.8,
  cloud: 3.5,
  chicken: 1,
  boar: 0.9
};

export function mountSpeedMultiplier(id: MountId | "none"): number {
  return MOUNT_SPEED_MULTIPLIER[id];
}
