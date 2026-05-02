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
  options?: { maxSamples?: number; spacing?: number; bankOffset?: number }
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
