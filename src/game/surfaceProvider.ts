// SurfaceProvider — S3 (2026-05-11)
//
// 统一地表契约：所有 player/camera/city/POI/water/vegetation/label 通过这一个
// 接口取地表高度 + 材质状态 + 距离 band。根治"每个模块各自采样地形导致穿模/
// 错音效"的回归循环（最近 R7/R10a/audit P0 多轮都打这一类 bug）。
//
// S3a (本 commit)：定义契约 + QinlingSurfaceProvider 默认实现 + 测试。
// S3b (下一 commit)：迁移现有 callsite (main.ts / waterSystemVisuals /
//   audio/triggerSystem / scenery / plankRoadRenderer) 走 surfaceProvider.sample()。
//
// S4 epoch schema 落地后，`epochId` 从 "modern" 切到 "tang-tianbao-14"；
// 同一接口下行运行时数据切换 (黄河北流 / 隋唐运河 / 唐代 POI 等)。
// S5 Runtime split 后，本 module 会移入 SurfaceRuntime，main.ts 不再直接 own 它。

import { Vector2, Vector3 } from "three";
import { TerrainSampler } from "./demSampler.js";
import type { EnvironmentController } from "./environment";
import { biomeWeightsAt, type BiomeId } from "./biomeZones.js";
import { unprojectWorldToGeo } from "./mapOrientation.js";
import { qinlingRegionBounds, qinlingRegionWorld } from "../data/qinlingRegion.js";

// ─── 公共类型 ─────────────────────────────────────────────────────────

export interface WorldXZ {
  x: number;
  z: number;
}

export type SurfaceMaterial =
  | "grass"
  | "soil"
  | "stone"
  | "sand"
  | "snow"
  | "water"
  | "mud"
  | "road";

export type FootstepMaterial =
  | "grass"
  | "stone"
  | "water"
  | "snow"
  | "mud"
  | "wood";

export interface SurfaceState {
  /** 表面分类（地质/植被/积水）— BotW chemistry 简化版 */
  material: SurfaceMaterial;
  /** 湿度 0..1 — rain/storm/mist 注入 */
  wetness: number;
  /** 积雪 0..1 — winter season 或 snow weather */
  snowCover: number;
  /** 沙尘 0..1 — 干旱 biome + 风 */
  dust: number;
  /** 水深 (世界单位)；material!=water 时为 0 */
  waterDepth: number;
  /** 反光 0..1 — water/snow 高，grass/soil 低；湿度提升 */
  reflectivity: number;
  /** 抓地力 0..1 — stone 1.0、water 0.3；湿/雪 降低 */
  traction: number;
  /** 脚步音类别 — audio/triggerSystem 直接用 */
  footstep: FootstepMaterial;
}

export interface SurfaceSample {
  /** 物理高度 — bilinear；用于 anchor 碰撞、玩家脚 */
  groundY: number;
  /** 渲染高度 — triangular；用于"贴 mesh 表面"（树/城/牌） */
  renderY: number;
  /** 法线（finite-diff 计算）— 用于光照、滑动方向 */
  normal: Vector3;
  /** 坡度（弧度，0 = 平地，π/2 = 垂直） */
  slope: number;
  /** 数据来源 — S5 后 chunk-aware 时区分 base/chunk/hero-patch */
  source: "base" | "chunk" | "hero-patch";
  /** 命中 chunk id；base 时 null */
  chunkId: string | null;
  /** 表面状态 — SSOT for material/wet/snow/etc. */
  state: SurfaceState;
}

export interface WaterSample {
  /** 水体类型 — S4 后扩 lake / ocean / wetland */
  kind: "none" | "river" | "lake" | "ocean" | "wetland";
  /** 水面高度 */
  surfaceY: number;
  /** 河床/湖底高度 */
  bedY: number;
  /** 视觉可见性 0..1 — 远景 polygonOffset/排序 bug 时 fade 到 0 */
  visibility: number;
  /** 水流方向 (XZ 单位向量)；静水/无可省 */
  flowDir?: Vector2;
}

export type DistanceBandName = "near" | "mid" | "far";

export interface DistanceBand {
  band: DistanceBandName;
  /** 世界单位距离 */
  distance: number;
  /** 0..1 in-band normalized (fade 曲线用) */
  bandT: number;
}

export interface SurfaceSampleOptions {
  /** 渲染用 LOD；player/碰撞 anchor 用 0 (full mesh) */
  lod?: 0 | 1 | 2 | 3;
}

export interface SurfaceProvider {
  /** 当前 epoch — S4 后切 tang-tianbao-14 */
  readonly epochId: string;
  sampleGround(p: WorldXZ, opts?: SurfaceSampleOptions): SurfaceSample;
  sampleWater(p: WorldXZ): WaterSample;
  classifyDistance(p: WorldXZ, camera: WorldXZ): DistanceBand;
}

// ─── Distance band thresholds (codex round 2 决) ─────────────────────────
// 全国尺度 1u ≈ 3.27km。near 0-30u (~0-100km)、mid 30-120u (~100-390km)、far 120+。
export const DISTANCE_BAND_NEAR = 30;
export const DISTANCE_BAND_FAR = 120;

// ─── Material 推断（biome × elevation × river → material） ─────────────
function materialFromBiome(
  biome: BiomeId,
  elevation: number,
  riverAffinity: number
): SurfaceMaterial {
  if (riverAffinity > 0.5) return "water";
  if (biome === "arid-desert") return "sand";
  if (biome === "loess-plateau") return "soil";
  if (biome === "alpine-meadow" && elevation > 8) return "stone";
  if (biome === "karst-mountains") return "stone";
  if (biome === "north-china-plain" || biome === "yungui-plateau") return "soil";
  // 其他湿润 biome 默认 grass
  return "grass";
}

function footstepFromMaterial(material: SurfaceMaterial): FootstepMaterial {
  switch (material) {
    case "water":
      return "water";
    case "snow":
      return "snow";
    case "stone":
    case "road":
      return "stone";
    case "mud":
      return "mud";
    case "grass":
    case "soil":
    case "sand":
      return "grass";
  }
}

function tractionFromMaterial(
  material: SurfaceMaterial,
  wetness: number,
  snowCover: number
): number {
  const base =
    material === "stone" || material === "road"
      ? 1.0
      : material === "grass"
        ? 0.9
        : material === "soil"
          ? 0.85
          : material === "sand"
            ? 0.7
            : material === "snow"
              ? 0.5
              : material === "mud"
                ? 0.4
                : material === "water"
                  ? 0.3
                  : 0.8;
  // 湿 -30%、雪 -20%
  const wet = 1 - wetness * 0.3;
  const snow = 1 - snowCover * 0.2;
  return Math.max(0, Math.min(1, base * wet * snow));
}

function reflectivityFromMaterial(
  material: SurfaceMaterial,
  wetness: number
): number {
  const base =
    material === "water"
      ? 0.95
      : material === "snow"
        ? 0.8
        : material === "sand"
          ? 0.4
          : material === "stone"
            ? 0.3
            : material === "road"
              ? 0.25
              : material === "mud"
                ? 0.2
                : material === "grass"
                  ? 0.15
                  : 0.1; // soil
  return Math.min(1, base + wetness * 0.3);
}

// ─── 默认实现：QinlingSurfaceProvider ─────────────────────────────────

export interface QinlingSurfaceProviderOptions {
  sampler: TerrainSampler;
  environment: EnvironmentController;
  bounds?: typeof qinlingRegionBounds;
  world?: typeof qinlingRegionWorld;
  /** epoch id；默认 "modern"，S4 切 "tang-tianbao-14" */
  epochId?: string;
}

export class QinlingSurfaceProvider implements SurfaceProvider {
  readonly epochId: string;
  private sampler: TerrainSampler;
  private environment: EnvironmentController;
  private bounds: typeof qinlingRegionBounds;
  private world: typeof qinlingRegionWorld;

  constructor(opts: QinlingSurfaceProviderOptions) {
    this.sampler = opts.sampler;
    this.environment = opts.environment;
    this.bounds = opts.bounds ?? qinlingRegionBounds;
    this.world = opts.world ?? qinlingRegionWorld;
    this.epochId = opts.epochId ?? "modern";
  }

  sampleGround(p: WorldXZ, opts: SurfaceSampleOptions = {}): SurfaceSample {
    const lod = opts.lod ?? 0;
    const groundY =
      lod === 0
        ? this.sampler.sampleHeight(p.x, p.z)
        : this.sampler.sampleHeightLod(p.x, p.z, lod);
    const renderY =
      lod === 0
        ? this.sampler.sampleSurfaceHeight(p.x, p.z)
        : this.sampler.sampleSurfaceHeightLod(p.x, p.z, lod);

    // 法线 via finite difference (4-tap)
    const dx = 0.5;
    const hL = this.sampler.sampleHeight(p.x - dx, p.z);
    const hR = this.sampler.sampleHeight(p.x + dx, p.z);
    const hD = this.sampler.sampleHeight(p.x, p.z - dx);
    const hU = this.sampler.sampleHeight(p.x, p.z + dx);
    const normal = new Vector3(
      -(hR - hL),
      2 * dx,
      -(hU - hD)
    ).normalize();
    const slope = Math.acos(Math.max(-1, Math.min(1, normal.y)));

    // material 推断：geo 坐标 → biome × river mask × elevation
    const geo = unprojectWorldToGeo(
      { x: p.x, z: p.z },
      this.bounds,
      this.world
    );
    const biomeWeights = biomeWeightsAt({ lon: geo.lon, lat: geo.lat });
    const biome = biomeWeights.biomeId;
    const riverAffinity = this.sampler.sampleRiver(p.x, p.z);

    // 环境注入：weather × season → wetness/snowCover
    const env = this.environment.state;
    const wetness =
      env.weather === "rain" || env.weather === "storm"
        ? 0.8
        : env.weather === "mist"
          ? 0.4
          : 0;
    const snowCover =
      env.weather === "snow"
        ? 0.7
        : env.season === "winter"
          ? 0.3
          : 0;

    const material = materialFromBiome(biome, groundY, riverAffinity);
    const footstep = footstepFromMaterial(material);
    const traction = tractionFromMaterial(material, wetness, snowCover);
    const reflectivity = reflectivityFromMaterial(material, wetness);
    const waterDepth = material === "water" ? 0.5 : 0;

    return {
      groundY,
      renderY,
      normal,
      slope,
      source: "base",
      chunkId: null,
      state: {
        material,
        wetness,
        snowCover,
        dust: 0, // S6 干旱 biome + 风方向决定
        waterDepth,
        reflectivity,
        traction,
        footstep
      }
    };
  }

  sampleWater(p: WorldXZ): WaterSample {
    const riverAffinity = this.sampler.sampleRiver(p.x, p.z);
    if (riverAffinity < 0.1) {
      return { kind: "none", surfaceY: 0, bedY: 0, visibility: 0 };
    }
    const bedY = this.sampler.sampleHeight(p.x, p.z);
    // 水面 = bed + 0.08（与 main.ts 湖面 offset 同源；S3b 时统一常量）
    const surfaceY = bedY + 0.08;
    return {
      kind: "river", // S4 后区分 lake/ocean/wetland
      surfaceY,
      bedY,
      visibility: Math.min(1, riverAffinity * 1.5)
    };
  }

  classifyDistance(p: WorldXZ, camera: WorldXZ): DistanceBand {
    const dx = p.x - camera.x;
    const dz = p.z - camera.z;
    const distance = Math.hypot(dx, dz);

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
        bandT:
          (distance - DISTANCE_BAND_NEAR) /
          (DISTANCE_BAND_FAR - DISTANCE_BAND_NEAR)
      };
    }

    return {
      band: "far",
      distance,
      // far 用对数级 t；> 2 × FAR 后稳定到 1
      bandT: Math.min(1, (distance - DISTANCE_BAND_FAR) / DISTANCE_BAND_FAR)
    };
  }
}
