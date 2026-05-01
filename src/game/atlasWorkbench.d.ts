import type {
  QinlingAtlasFeature,
  QinlingAtlasLayer,
  QinlingAtlasLayerId,
  QinlingAtlasPoint
} from "./qinlingAtlas.js";

export interface AtlasWorkbenchState {
  visibleLayerIds: Set<QinlingAtlasLayerId>;
  isFullscreen: boolean;
  mapView: AtlasMapView;
  selectedFeatureId: string | null;
}

export interface AtlasMapView {
  scale: number;
  offsetX: number;
  offsetY: number;
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

export function atlasMapWorldToCanvasPoint(
  point: QinlingAtlasPoint,
  world: { width: number; depth: number },
  canvas: { width: number; height: number },
  view: AtlasMapView
): QinlingAtlasPoint;

export function atlasMapCanvasToWorldPoint(
  point: QinlingAtlasPoint,
  world: { width: number; depth: number },
  canvas: { width: number; height: number },
  view: AtlasMapView
): QinlingAtlasPoint;

export function zoomAtlasMapAtPoint(
  state: AtlasWorkbenchState,
  zoomFactor: number,
  pointer: QinlingAtlasPoint,
  world: { width: number; depth: number },
  canvas: { width: number; height: number }
): AtlasWorkbenchState;

export function panAtlasMap(
  state: AtlasWorkbenchState,
  delta: QinlingAtlasPoint
): AtlasWorkbenchState;

export function resetAtlasMapView(
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
