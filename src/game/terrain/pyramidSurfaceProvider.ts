// terrain/pyramidSurfaceProvider.ts —
//
// 实现旧 SurfaceProvider 接口，底层换成 P1 pyramid 数据。
// **所有现有 callsite (player Y / scenery / city anchor / audio footstep)
// 不用改一行**，main.ts 只需在 feature flag 下传 PyramidSurfaceProvider
// 替代 QinlingSurfaceProvider。
//
// 这是 P5 callsite 迁移的 zero-risk 接入点。

import { Vector2, Vector3 } from "three";
import type {
  SurfaceProvider,
  SurfaceSample,
  SurfaceSampleOptions,
  SurfaceState,
  WaterSample,
  WorldXZ,
  DistanceBand,
  FootstepMaterial,
  SurfaceMaterial
} from "../surfaceProvider";
import {
  DISTANCE_BAND_NEAR,
  DISTANCE_BAND_FAR
} from "../surfaceProvider.js";
import { PyramidSampler } from "./pyramidSampler.js";

const SLOPE_EPSILON = 0.5; // world units; finite-diff step
const DEFAULT_SNOW_THRESHOLD = 25; // world Y above which snow appears

export interface PyramidSurfaceProviderOptions {
  sampler: PyramidSampler;
  epochId?: string;
}

export class PyramidSurfaceProvider implements SurfaceProvider {
  readonly epochId: string;
  readonly sampler: PyramidSampler;

  constructor(opts: PyramidSurfaceProviderOptions) {
    this.sampler = opts.sampler;
    this.epochId = opts.epochId ?? "modern";
  }

  sampleGround(p: WorldXZ, _opts: SurfaceSampleOptions = {}): SurfaceSample {
    const groundY = this.sampler.sampleHeightWorld(p.x, p.z);

    // Finite-diff normal (4-sample)
    const eps = SLOPE_EPSILON;
    const yLeft = this.sampler.sampleHeightWorld(p.x - eps, p.z);
    const yRight = this.sampler.sampleHeightWorld(p.x + eps, p.z);
    const yUp = this.sampler.sampleHeightWorld(p.x, p.z - eps);
    const yDown = this.sampler.sampleHeightWorld(p.x, p.z + eps);
    const dx = (yRight - yLeft) / (2 * eps);
    const dz = (yDown - yUp) / (2 * eps);
    const normal = new Vector3(-dx, 1, -dz).normalize();
    const slope = Math.acos(Math.max(0, Math.min(1, normal.y)));

    const material = inferMaterial(groundY, slope);
    const state: SurfaceState = {
      material,
      wetness: 0,
      snowCover: groundY > DEFAULT_SNOW_THRESHOLD ? 1 : 0,
      dust: 0,
      waterDepth: 0,
      reflectivity: reflectivityFor(material),
      traction: tractionFor(material),
      footstep: footstepFor(material)
    };

    return {
      groundY,
      renderY: groundY,
      normal,
      slope,
      source: "chunk",
      chunkId: null,
      state
    };
  }

  sampleWater(_p: WorldXZ): WaterSample {
    // P4 will add river / ocean mask lookup. For now: no water.
    return {
      kind: "none",
      surfaceY: 0,
      bedY: 0,
      visibility: 0,
      flowDir: new Vector2(0, 0)
    };
  }

  classifyDistance(p: WorldXZ, camera: WorldXZ): DistanceBand {
    const dx = p.x - camera.x;
    const dz = p.z - camera.z;
    const distance = Math.sqrt(dx * dx + dz * dz);
    if (distance < DISTANCE_BAND_NEAR) {
      return {
        band: "near",
        distance,
        bandT: distance / DISTANCE_BAND_NEAR
      };
    }
    if (distance < DISTANCE_BAND_FAR) {
      return {
        band: "mid",
        distance,
        bandT: (distance - DISTANCE_BAND_NEAR) / (DISTANCE_BAND_FAR - DISTANCE_BAND_NEAR)
      };
    }
    return {
      band: "far",
      distance,
      bandT: Math.min(1, (distance - DISTANCE_BAND_FAR) / DISTANCE_BAND_FAR)
    };
  }
}

// ─── Material 推断 helpers ──────────────────────────────────────

function inferMaterial(groundY: number, slope: number): SurfaceMaterial {
  if (groundY > DEFAULT_SNOW_THRESHOLD) return "snow";
  if (slope > 0.6) return "stone"; // 陡坡 → 岩
  if (groundY < 1) return "sand"; // 低洼 / 海岸 → 沙
  if (groundY < 6) return "grass"; // 平原 → 草
  return "soil"; // 丘陵 → 土
}

function reflectivityFor(m: SurfaceMaterial): number {
  switch (m) {
    case "water":
      return 0.85;
    case "snow":
      return 0.7;
    case "stone":
      return 0.25;
    case "sand":
      return 0.4;
    case "grass":
      return 0.18;
    case "soil":
      return 0.12;
    case "mud":
      return 0.3;
    case "road":
      return 0.22;
    default:
      return 0.2;
  }
}

function tractionFor(m: SurfaceMaterial): number {
  switch (m) {
    case "stone":
    case "road":
      return 1.0;
    case "grass":
    case "soil":
      return 0.85;
    case "sand":
      return 0.65;
    case "snow":
      return 0.6;
    case "mud":
      return 0.5;
    case "water":
      return 0.3;
    default:
      return 0.7;
  }
}

function footstepFor(m: SurfaceMaterial): FootstepMaterial {
  switch (m) {
    case "water":
      return "water";
    case "snow":
      return "snow";
    case "stone":
    case "road":
      return "stone";
    case "mud":
      return "mud";
    case "sand":
    case "soil":
    case "grass":
    default:
      return "grass";
  }
}
