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
  cloud: 4,
  chicken: 1.1,
  boar: 0.9
};

export function mountSpeedMultiplier(id: MountId): number {
  return MOUNT_SPEED_MULTIPLIER[id];
}
