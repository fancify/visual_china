import {
  atlasVisibleFeatures,
  featureWorldPoints,
  worldPointToOverviewPixel
} from "./atlasRender.js";
import type {
  QinlingAtlasFeature,
  QinlingAtlasLayer,
  QinlingAtlasLayerId,
  QinlingAtlasPoint
} from "./qinlingAtlas.js";

export interface AtlasMapView {
  scale: number;
  offsetX: number;
  offsetY: number;
  fitMode?: "stretch" | "cover" | "contain";
}

export interface AtlasWorkbenchState {
  visibleLayerIds: Set<QinlingAtlasLayerId>;
  isFullscreen: boolean;
  mapView: AtlasMapView;
  selectedFeatureId: string | null;
}

export interface FindAtlasFeatureOptions {
  minDisplayPriority?: number;
}

interface WorldDims {
  width: number;
  depth: number;
}

interface CanvasDims {
  width: number;
  height: number;
}

const LOCKED_LAYER_IDS = new Set<QinlingAtlasLayerId>(["landform" as QinlingAtlasLayerId]);
const DEFAULT_MAP_VIEW: AtlasMapView = { scale: 1, offsetX: 0, offsetY: 0 };
const MIN_MAP_SCALE = 1;
const MAX_MAP_SCALE = 8;

export function createAtlasWorkbenchState(layers: QinlingAtlasLayer[]): AtlasWorkbenchState {
  return {
    visibleLayerIds: new Set(
      layers.filter((layer) => layer.defaultVisible).map((layer) => layer.id)
    ),
    isFullscreen: false,
    mapView: { ...DEFAULT_MAP_VIEW },
    selectedFeatureId: null
  };
}

export function toggleAtlasLayer(
  state: AtlasWorkbenchState,
  layerId: QinlingAtlasLayerId
): AtlasWorkbenchState {
  const visibleLayerIds = new Set(state.visibleLayerIds);

  if (LOCKED_LAYER_IDS.has(layerId)) {
    visibleLayerIds.add(layerId);
  } else if (visibleLayerIds.has(layerId)) {
    visibleLayerIds.delete(layerId);
  } else {
    visibleLayerIds.add(layerId);
  }

  return {
    ...state,
    visibleLayerIds
  };
}

export function selectAtlasFeature(
  state: AtlasWorkbenchState,
  featureId: string | null
): AtlasWorkbenchState {
  return {
    ...state,
    selectedFeatureId: featureId
  };
}

export function setAtlasFullscreen(
  state: AtlasWorkbenchState,
  isFullscreen: boolean
): AtlasWorkbenchState {
  return {
    ...state,
    isFullscreen,
    mapView: {
      ...(state.mapView ?? DEFAULT_MAP_VIEW),
      // 全屏：contain 模式（地图完整显示，不裁切）。
      // 小窗 mini-map：stretch 模式（充满 220x270 框）。
      fitMode: isFullscreen ? "contain" : "stretch"
    }
  };
}

export function toggleAtlasFullscreen(state: AtlasWorkbenchState): AtlasWorkbenchState {
  return setAtlasFullscreen(state, !state.isFullscreen);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function canvasCenter(canvas: CanvasDims): QinlingAtlasPoint {
  return {
    x: canvas.width / 2,
    y: canvas.height / 2
  };
}

function atlasFitFrame(
  world: WorldDims,
  canvas: CanvasDims,
  fitMode: AtlasMapView["fitMode"] = "stretch"
): { x: number; y: number; width: number; height: number } {
  if (fitMode === "cover") {
    const scale = Math.max(canvas.width / world.width, canvas.height / world.depth);
    const width = world.width * scale;
    const height = world.depth * scale;
    return {
      x: (canvas.width - width) / 2,
      y: (canvas.height - height) / 2,
      width,
      height
    };
  }

  if (fitMode === "contain") {
    const scale = Math.min(canvas.width / world.width, canvas.height / world.depth);
    const width = world.width * scale;
    const height = world.depth * scale;
    return {
      x: (canvas.width - width) / 2,
      y: (canvas.height - height) / 2,
      width,
      height
    };
  }

  return {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height
  };
}

function transformedAtlasBounds(
  world: WorldDims,
  canvas: CanvasDims,
  view: AtlasMapView
): { minX: number; maxX: number; minY: number; maxY: number } {
  const west = atlasMapWorldToCanvasPoint({ x: -world.width / 2, y: 0 }, world, canvas, view);
  const east = atlasMapWorldToCanvasPoint({ x: world.width / 2, y: 0 }, world, canvas, view);
  const north = atlasMapWorldToCanvasPoint({ x: 0, y: world.depth / 2 }, world, canvas, view);
  const south = atlasMapWorldToCanvasPoint({ x: 0, y: -world.depth / 2 }, world, canvas, view);

  return {
    minX: Math.min(west.x, east.x),
    maxX: Math.max(west.x, east.x),
    minY: Math.min(north.y, south.y),
    maxY: Math.max(north.y, south.y)
  };
}

function clampOffsetForAxis(offset: number, min: number, max: number, size: number): number {
  const span = max - min;

  if (span <= size) {
    return offset + (size * 0.5 - (min + max) * 0.5);
  }

  if (min > 0) {
    return offset - min;
  }

  if (max < size) {
    return offset + size - max;
  }

  return offset;
}

function clampMapView(view: AtlasMapView, world?: WorldDims, canvas?: CanvasDims): AtlasMapView {
  if (!world || !canvas) {
    return view;
  }

  const bounds = transformedAtlasBounds(world, canvas, view);

  return {
    ...view,
    offsetX: clampOffsetForAxis(view.offsetX, bounds.minX, bounds.maxX, canvas.width),
    offsetY: clampOffsetForAxis(view.offsetY, bounds.minY, bounds.maxY, canvas.height)
  };
}

export function atlasMapWorldToCanvasPoint(
  point: QinlingAtlasPoint,
  world: WorldDims,
  canvas: CanvasDims,
  view: AtlasMapView
): QinlingAtlasPoint {
  const frame = atlasFitFrame(world, canvas, view.fitMode);
  const base = {
    x: frame.x + ((point.x / world.width) + 0.5) * frame.width,
    y: frame.y + (point.y / world.depth + 0.5) * frame.height
  };
  const center = canvasCenter(canvas);

  return {
    x: center.x + (base.x - center.x) * view.scale + view.offsetX,
    y: center.y + (base.y - center.y) * view.scale + view.offsetY
  };
}

export function atlasMapCanvasToWorldPoint(
  point: QinlingAtlasPoint,
  world: WorldDims,
  canvas: CanvasDims,
  view: AtlasMapView
): QinlingAtlasPoint {
  const center = canvasCenter(canvas);
  const base = {
    x: center.x + (point.x - center.x - view.offsetX) / view.scale,
    y: center.y + (point.y - center.y - view.offsetY) / view.scale
  };
  const frame = atlasFitFrame(world, canvas, view.fitMode);

  return {
    x: (((base.x - frame.x) / frame.width) - 0.5) * world.width,
    y: (((base.y - frame.y) / frame.height) - 0.5) * world.depth
  };
}

export function zoomAtlasMapAtPoint(
  state: AtlasWorkbenchState,
  zoomFactor: number,
  pointer: QinlingAtlasPoint,
  world: WorldDims,
  canvas: CanvasDims
): AtlasWorkbenchState {
  const currentView = state.mapView ?? DEFAULT_MAP_VIEW;
  const nextScale = clamp(currentView.scale * zoomFactor, MIN_MAP_SCALE, MAX_MAP_SCALE);
  const anchoredWorldPoint = atlasMapCanvasToWorldPoint(pointer, world, canvas, currentView);
  const center = canvasCenter(canvas);
  const frame = atlasFitFrame(world, canvas, currentView.fitMode);
  const anchoredBase = {
    x: frame.x + ((anchoredWorldPoint.x / world.width) + 0.5) * frame.width,
    y: frame.y + (anchoredWorldPoint.y / world.depth + 0.5) * frame.height
  };

  const mapView = clampMapView(
    {
      scale: nextScale,
      offsetX: pointer.x - center.x - (anchoredBase.x - center.x) * nextScale,
      offsetY: pointer.y - center.y - (anchoredBase.y - center.y) * nextScale,
      fitMode: currentView.fitMode
    },
    world,
    canvas
  );

  return {
    ...state,
    mapView
  };
}

export function panAtlasMap(
  state: AtlasWorkbenchState,
  delta: QinlingAtlasPoint,
  world?: WorldDims,
  canvas?: CanvasDims
): AtlasWorkbenchState {
  const currentView = state.mapView ?? DEFAULT_MAP_VIEW;
  const mapView = clampMapView(
    {
      ...currentView,
      offsetX: currentView.offsetX + delta.x,
      offsetY: currentView.offsetY + delta.y
    },
    world,
    canvas
  );

  return {
    ...state,
    mapView
  };
}

export function resetAtlasMapView(state: AtlasWorkbenchState): AtlasWorkbenchState {
  const mapView: AtlasMapView = { ...DEFAULT_MAP_VIEW };

  if (state.mapView?.fitMode) {
    mapView.fitMode = state.mapView.fitMode;
  }

  return {
    ...state,
    mapView
  };
}

export function selectedAtlasFeature(
  state: AtlasWorkbenchState,
  features: QinlingAtlasFeature[]
): QinlingAtlasFeature | null {
  if (!state.selectedFeatureId) {
    return null;
  }

  return features.find((feature) => feature.id === state.selectedFeatureId) ?? null;
}

function distanceToSegment(
  point: QinlingAtlasPoint,
  start: QinlingAtlasPoint,
  end: QinlingAtlasPoint
): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSq = dx * dx + dy * dy;

  if (lengthSq === 0) {
    return Math.hypot(point.x - start.x, point.y - start.y);
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSq)
  );
  const projected = {
    x: start.x + dx * t,
    y: start.y + dy * t
  };

  return Math.hypot(point.x - projected.x, point.y - projected.y);
}

function featureHitDistance(
  feature: QinlingAtlasFeature,
  pointer: QinlingAtlasPoint,
  world: WorldDims,
  canvas: CanvasDims,
  view: AtlasMapView = DEFAULT_MAP_VIEW
): number {
  const points = featureWorldPoints(feature).map((point) =>
    atlasMapWorldToCanvasPoint(point, world, canvas, view)
  );
  const center = points.reduce(
    (total, point) => ({
      x: total.x + point.x / points.length,
      y: total.y + point.y / points.length
    }),
    { x: 0, y: 0 }
  );

  if (feature.geometry === "point") {
    return Math.hypot(pointer.x - center.x, pointer.y - center.y);
  }

  if (feature.geometry === "area") {
    return Math.hypot(pointer.x - center.x, pointer.y - center.y);
  }

  let best = Number.POSITIVE_INFINITY;

  for (let index = 0; index < points.length - 1; index += 1) {
    best = Math.min(best, distanceToSegment(pointer, points[index], points[index + 1]));
  }

  return best;
}

export function findAtlasFeatureAtCanvasPoint(
  features: QinlingAtlasFeature[],
  state: AtlasWorkbenchState,
  pointer: QinlingAtlasPoint,
  world: WorldDims,
  canvas: CanvasDims,
  maxDistance: number = 14,
  options: FindAtlasFeatureOptions = {}
): QinlingAtlasFeature | null {
  // 跟 atlasVisibleFeatures 在 drawOverviewMap 那边的过滤参数对齐：
  // 默认按 atlasMinimumDisplayPriority(scale) 过滤，避免渲染上看不见
  // 的低优先级 feature 仍然 clickable（codex 8c58368 P2 抓到 county 城
  // 市 priority 6 在 default scale 不画但点空白处仍弹出 card）。
  const visible = atlasVisibleFeatures(
    features,
    [...state.visibleLayerIds].map((id) => ({ id, defaultVisible: true } as QinlingAtlasLayer)),
    {
      minDisplayPriority: options.minDisplayPriority ?? Number.NEGATIVE_INFINITY
    }
  );
  let best: QinlingAtlasFeature | null = null;
  let bestDistance = maxDistance;
  let bestRank = Number.POSITIVE_INFINITY;

  visible.forEach((feature) => {
    const distance = featureHitDistance(
      feature,
      pointer,
      world,
      canvas,
      state.mapView ?? DEFAULT_MAP_VIEW
    );
    const rank = feature.geometry === "point" ? 0 : feature.geometry === "polyline" ? 1 : 2;

    if (
      distance <= maxDistance &&
      (rank < bestRank ||
        (rank === bestRank && distance < bestDistance) ||
        (rank === bestRank &&
          distance === bestDistance &&
          feature.displayPriority > (best?.displayPriority ?? -1)))
    ) {
      best = feature;
      bestDistance = distance;
      bestRank = rank;
    }
  });

  return best;
}
