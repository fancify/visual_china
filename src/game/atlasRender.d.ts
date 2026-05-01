import type {
  QinlingAtlasFeature,
  QinlingAtlasLayer,
  QinlingAtlasLayerId,
  QinlingAtlasPoint
} from "./qinlingAtlas.js";

export const atlasLayerDrawOrder: QinlingAtlasLayerId[];

export function worldPointToOverviewPixel(
  point: QinlingAtlasPoint,
  world: { width: number; depth: number },
  canvas: { width: number; height: number }
): QinlingAtlasPoint;

export function atlasCanvasPoint(
  point: QinlingAtlasPoint,
  world: { width: number; depth: number },
  canvas: { width: number; height: number }
): QinlingAtlasPoint;

export function parseMissingDemTileNames(notes?: string[]): string[];

export function missingDemTileWorldRects(asset: {
  bounds?: { west: number; east: number; south: number; north: number };
  world?: { width: number; depth: number };
  notes?: string[];
}): Array<{
  tileName: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}>;

export function atlasMinimumDisplayPriority(options?: {
  fullscreen?: boolean;
  scale?: number;
}): number;

export function isVerifiedAtlasFeature(
  feature: QinlingAtlasFeature
): boolean;

export function atlasVisibleFeatures(
  features: QinlingAtlasFeature[],
  layers: QinlingAtlasLayer[],
  options?: { minDisplayPriority?: number; includeUnverifiedFeatures?: boolean }
): QinlingAtlasFeature[];

export function featureWorldPoints(
  feature: QinlingAtlasFeature
): QinlingAtlasPoint[];

export function atlasFeatureCenter(
  feature: Pick<QinlingAtlasFeature, "world">,
  world: { width: number; depth: number },
  canvas: { width: number; height: number }
): QinlingAtlasPoint;
