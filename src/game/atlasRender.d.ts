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

export function atlasVisibleFeatures(
  features: QinlingAtlasFeature[],
  layers: QinlingAtlasLayer[]
): QinlingAtlasFeature[];

export function featureWorldPoints(
  feature: QinlingAtlasFeature
): QinlingAtlasPoint[];

export function atlasFeatureCenter(
  feature: Pick<QinlingAtlasFeature, "world">,
  world: { width: number; depth: number },
  canvas: { width: number; height: number }
): QinlingAtlasPoint;
