import type {
  QinlingAtlasFeature,
  QinlingAtlasLayer,
  QinlingAtlasLayerId,
  QinlingAtlasPoint
} from "./qinlingAtlas.js";

export interface AtlasWorkbenchState {
  visibleLayerIds: Set<QinlingAtlasLayerId>;
  isFullscreen: boolean;
  selectedFeatureId: string | null;
}

export function createAtlasWorkbenchState(
  layers: QinlingAtlasLayer[]
): AtlasWorkbenchState;

export function toggleAtlasLayer(
  state: AtlasWorkbenchState,
  layerId: QinlingAtlasLayerId
): AtlasWorkbenchState;

export function selectAtlasFeature(
  state: AtlasWorkbenchState,
  featureId: string | null
): AtlasWorkbenchState;

export function setAtlasFullscreen(
  state: AtlasWorkbenchState,
  isFullscreen: boolean
): AtlasWorkbenchState;

export function toggleAtlasFullscreen(
  state: AtlasWorkbenchState
): AtlasWorkbenchState;

export function selectedAtlasFeature(
  state: AtlasWorkbenchState,
  features: QinlingAtlasFeature[]
): QinlingAtlasFeature | null;

export function findAtlasFeatureAtCanvasPoint(
  features: QinlingAtlasFeature[],
  state: AtlasWorkbenchState,
  pointer: QinlingAtlasPoint,
  world: { width: number; depth: number },
  canvas: { width: number; height: number },
  maxDistance?: number
): QinlingAtlasFeature | null;
