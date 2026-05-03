import { MathUtils } from "three";

export interface TerrainSurfaceSampler {
  sampleSurfaceHeight(x: number, z: number): number;
}

export interface AvatarTiltInput {
  heading: number;
  position: {
    x: number;
    z: number;
  };
  sampler: TerrainSurfaceSampler;
  step?: number;
  maxTilt?: number;
}

export interface AvatarTilt {
  pitch: number;
  roll: number;
}

export const AVATAR_TILT_SAMPLE_STEP = 1.2;
export const AVATAR_TILT_MAX_RADIANS = Math.PI / 6;

export function computeAvatarTilt({
  heading,
  position,
  sampler,
  step = AVATAR_TILT_SAMPLE_STEP,
  maxTilt = AVATAR_TILT_MAX_RADIANS
}: AvatarTiltInput): AvatarTilt {
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
