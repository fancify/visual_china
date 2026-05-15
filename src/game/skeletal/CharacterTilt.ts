import { MathUtils } from "three";
import type { TerrainSurfaceSampler } from "./demoTerrain.js";

/**
 * 复制自旧 src/game/avatarTilt.ts (M4 前不动旧文件，所以直接 copy 算法
 * 而不是 import)。算法：取 character 前/后/左/右 4 个采样点的地面高度，
 * 用前后差算 pitch、左右差算 roll。clamp 到 ±π/6 防止悬崖处过度倾斜。
 *
 * 仅在 ground mode 应用。M2 御剑 / 筋斗云 / M3 骑乘 状态下角色姿态由
 * 飞行 quat / parent bone 决定，tilt 关闭。
 */

export const AVATAR_TILT_SAMPLE_STEP = 1.2;
export const AVATAR_TILT_MAX_RADIANS = Math.PI / 6;

export interface CharacterTiltInput {
  heading: number;
  position: { x: number; z: number };
  sampler: TerrainSurfaceSampler;
  step?: number;
  maxTilt?: number;
}

export interface CharacterTilt {
  pitch: number;
  roll: number;
}

export function computeCharacterTilt({
  heading,
  position,
  sampler,
  step = AVATAR_TILT_SAMPLE_STEP,
  maxTilt = AVATAR_TILT_MAX_RADIANS
}: CharacterTiltInput): CharacterTilt {
  const forwardX = Math.cos(heading);
  const forwardZ = -Math.sin(heading);
  const rightX = Math.sin(heading);
  const rightZ = Math.cos(heading);
  const front = sampler.sampleSurfaceHeight(
    position.x + forwardX * step,
    position.z + forwardZ * step
  );
  const back = sampler.sampleSurfaceHeight(
    position.x - forwardX * step,
    position.z - forwardZ * step
  );
  const right = sampler.sampleSurfaceHeight(
    position.x + rightX * step,
    position.z + rightZ * step
  );
  const left = sampler.sampleSurfaceHeight(
    position.x - rightX * step,
    position.z - rightZ * step
  );

  const pitch = MathUtils.clamp(-Math.atan2(front - back, step * 2), -maxTilt, maxTilt);
  const roll = MathUtils.clamp(Math.atan2(left - right, step * 2), -maxTilt, maxTilt);

  return { pitch, roll };
}
