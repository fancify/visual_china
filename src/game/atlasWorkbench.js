import {
  atlasFeatureCenter,
  atlasVisibleFeatures,
  featureWorldPoints,
  worldPointToOverviewPixel
} from "./atlasRender.js";

const LOCKED_LAYER_IDS = new Set(["landform"]);

export function createAtlasWorkbenchState(layers) {
  return {
    visibleLayerIds: new Set(
      layers.filter((layer) => layer.defaultVisible).map((layer) => layer.id)
    ),
    isFullscreen: false,
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

function featureHitDistance(feature, pointer, world, canvas) {
  const center = atlasFeatureCenter(feature, world, canvas);

  if (feature.geometry === "point") {
    return Math.hypot(pointer.x - center.x, pointer.y - center.y);
  }

  const points = featureWorldPoints(feature).map((point) =>
    worldPointToOverviewPixel(point, world, canvas)
  );

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
    const distance = featureHitDistance(feature, pointer, world, canvas);
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
