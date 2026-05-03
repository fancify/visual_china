export interface OcclusionPoint {
  x: number;
  y: number;
  z: number;
}

export interface SurfaceHeightSampler {
  sampleSurfaceHeight(x: number, z: number): number;
}

export interface TerrainOcclusionOptions {
  camera: OcclusionPoint;
  target: OcclusionPoint;
  sampler: SurfaceHeightSampler;
  steps?: number;
  tolerance?: number;
}

const DEFAULT_OCCLUSION_STEPS = 24;
const DEFAULT_OCCLUSION_TOLERANCE = 0.25;

export function isSpriteOccludedByTerrain({
  camera,
  target,
  sampler,
  steps = DEFAULT_OCCLUSION_STEPS,
  tolerance = DEFAULT_OCCLUSION_TOLERANCE
}: TerrainOcclusionOptions): boolean {
  const dx = target.x - camera.x;
  const dy = target.y - camera.y;
  const dz = target.z - camera.z;

  for (let i = 1; i <= steps; i += 1) {
    const t = i / (steps + 1);
    const sx = camera.x + dx * t;
    const sy = camera.y + dy * t;
    const sz = camera.z + dz * t;
    const groundY = sampler.sampleSurfaceHeight(sx, sz);

    if (groundY > sy + tolerance) {
      return true;
    }
  }

  return false;
}
