import type { QinlingAtlasFeature } from "./qinlingAtlas.js";

export function isRenderableWaterFeature(feature: QinlingAtlasFeature): boolean;

export function selectRenderableWaterFeatures(
  features: QinlingAtlasFeature[],
  options?: { maxFeatures?: number; minDisplayPriority?: number }
): QinlingAtlasFeature[];

export function waterLabelPoint(
  feature: QinlingAtlasFeature
): { x: number; y: number } | null;

export function buildWaterRibbonVertices(
  points: Array<{ x: number; y: number }>,
  options: {
    width: number;
    yOffset?: number;
    /** 折线密化最大段长（默认 0.9，支流可传 1.5 节省顶点） */
    maxSegmentLength?: number;
    sampleHeight(x: number, z: number): number;
  }
): Float32Array;

export function buildWaterRibbonAlphas(
  points: Array<{ x: number; y: number }>,
  options: {
    /** 必须跟 buildWaterRibbonVertices 一致，保证顶点数对齐 */
    maxSegmentLength?: number;
    /** 起点 alpha (1 = 不透明，0 = 完全透明). 默认 1 */
    fadeStartAlpha?: number;
    /** 终点 alpha. 默认 1 */
    fadeEndAlpha?: number;
    /** fade 段在 polyline 头/尾占的比例. 默认 0.08 */
    fadeFraction?: number;
    /** 中段 alpha (默认 1) */
    baseOpacity?: number;
  }
): Float32Array;

export function densifyPolyline(
  points: Array<{ x: number; y: number }>,
  maxSegmentLength: number
): Array<{ x: number; y: number }>;

export function riverCorridorInfluenceAtPoint(
  x: number,
  z: number,
  features: QinlingAtlasFeature[],
  options?: { waterRadius?: number; bankRadius?: number }
): {
  water: number;
  bank: number;
  vegetation: number;
  distance: number;
};

export function buildRiverVegetationSamples(
  features: QinlingAtlasFeature[],
  options?: {
    maxSamples?: number;
    spacing?: number;
    bankOffset?: number;
    minDisplayPriority?: number;
  }
): Array<{
  featureId: string;
  x: number;
  z: number;
  rotation: number;
  scale: number;
  variant: "tree" | "shrub";
}>;

export function waterVisualStyle(feature: QinlingAtlasFeature): {
  bankWidth: number;
  bankYOffset: number;
  bankOpacity: number;
  ribbonWidth: number;
  ribbonYOffset: number;
  ribbonOpacity: number;
  depthTest: boolean;
};

export function waterEnvironmentVisualStyle(
  style: ReturnType<typeof waterVisualStyle>,
  visuals?: {
    daylight?: number;
    waterShimmer?: number;
    ambientIntensity?: number;
    sunIntensity?: number;
    moonOpacity?: number;
    fogDensity?: number;
    mistOpacity?: number;
    precipitationOpacity?: number;
  }
): {
  bankOpacity: number;
  ribbonOpacity: number;
  colorMultiplier: number;
};
