import {
  atlasVisibleFeatures,
  featureWorldPoints,
  worldPointToOverviewPixel
} from "./atlasRender.js";

const LOCKED_LAYER_IDS = new Set(["landform"]);
const DEFAULT_MAP_VIEW = { scale: 1, offsetX: 0, offsetY: 0 };
const MIN_MAP_SCALE = 1;
const MAX_MAP_SCALE = 8;

export function createAtlasWorkbenchState(layers) {
  return {
    visibleLayerIds: new Set(
      layers.filter((layer) => layer.defaultVisible).map((layer) => layer.id)
    ),
    isFullscreen: false,
    mapView: { ...DEFAULT_MAP_VIEW },
    selectedFeatureId: null
  };
}

export function toggleAtlasLayer(state, layerId) {
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

export function selectAtlasFeature(state, featureId) {
  return {
    ...state,
    selectedFeatureId: featureId
  };
}

export function setAtlasFullscreen(state, isFullscreen) {
  return {
    ...state,
    isFullscreen
  };
}

export function toggleAtlasFullscreen(state) {
  return setAtlasFullscreen(state, !state.isFullscreen);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function canvasCenter(canvas) {
  return {
    x: canvas.width / 2,
    y: canvas.height / 2
  };
}

export function atlasMapWorldToCanvasPoint(point, world, canvas, view) {
  const base = worldPointToOverviewPixel(point, world, canvas);
  const center = canvasCenter(canvas);

  return {
    x: center.x + (base.x - center.x) * view.scale + view.offsetX,
    y: center.y + (base.y - center.y) * view.scale + view.offsetY
  };
}

export function atlasMapCanvasToWorldPoint(point, world, canvas, view) {
  const center = canvasCenter(canvas);
  const base = {
    x: center.x + (point.x - center.x - view.offsetX) / view.scale,
    y: center.y + (point.y - center.y - view.offsetY) / view.scale
  };

  return {
    x: ((base.x / canvas.width) - 0.5) * world.width,
    y: (0.5 - base.y / canvas.height) * world.depth
  };
}

export function zoomAtlasMapAtPoint(state, zoomFactor, pointer, world, canvas) {
  const currentView = state.mapView ?? DEFAULT_MAP_VIEW;
  const nextScale = clamp(
    currentView.scale * zoomFactor,
    MIN_MAP_SCALE,
    MAX_MAP_SCALE
  );
  const anchoredWorldPoint = atlasMapCanvasToWorldPoint(
    pointer,
    world,
    canvas,
    currentView
  );
  const center = canvasCenter(canvas);
  const anchoredBase = worldPointToOverviewPixel(anchoredWorldPoint, world, canvas);

  return {
    ...state,
    mapView: {
      scale: nextScale,
      offsetX: pointer.x - center.x - (anchoredBase.x - center.x) * nextScale,
      offsetY: pointer.y - center.y - (anchoredBase.y - center.y) * nextScale
    }
  };
}

export function panAtlasMap(state, delta) {
  const currentView = state.mapView ?? DEFAULT_MAP_VIEW;

  return {
    ...state,
    mapView: {
      ...currentView,
      offsetX: currentView.offsetX + delta.x,
      offsetY: currentView.offsetY + delta.y
    }
  };
}

export function resetAtlasMapView(state) {
  return {
    ...state,
    mapView: { ...DEFAULT_MAP_VIEW }
  };
}

export function selectedAtlasFeature(state, features) {
  if (!state.selectedFeatureId) {
    return null;
  }

  return features.find((feature) => feature.id === state.selectedFeatureId) ?? null;
}

function distanceToSegment(point, start, end) {
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

function featureHitDistance(feature, pointer, world, canvas, view = DEFAULT_MAP_VIEW) {
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
  features,
  state,
  pointer,
  world,
  canvas,
  maxDistance = 14
) {
  const visible = atlasVisibleFeatures(features, [
    ...state.visibleLayerIds
  ].map((id) => ({ id, defaultVisible: true })));
  let best = null;
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
