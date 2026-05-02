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
    isFullscreen,
    mapView: {
      ...(state.mapView ?? DEFAULT_MAP_VIEW),
      // 全屏：contain 模式（地图完整显示，不裁切）。
      // 小窗 mini-map：stretch 模式（充满 220x270 框）。
      fitMode: isFullscreen ? "contain" : "stretch"
    }
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

function atlasFitFrame(world, canvas, fitMode = "stretch") {
  if (fitMode === "cover") {
    // 覆盖模式：地图填满 canvas 但会裁切短边方向。
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
    // 包含模式：保持长宽比，地图完整显示，多余空间留空。
    // 这是 atlas 全屏的默认——保证用户看到整个秦岭区域，
    // 而不是被 cover 模式裁掉汉中/四川盆地。
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

  // 默认 stretch：填充整个 canvas（小窗 minimap 用，长宽比与 world 不一致时会变形）。
  return {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height
  };
}

function transformedAtlasBounds(world, canvas, view) {
  const west = atlasMapWorldToCanvasPoint(
    { x: -world.width / 2, y: 0 },
    world,
    canvas,
    view
  );
  const east = atlasMapWorldToCanvasPoint(
    { x: world.width / 2, y: 0 },
    world,
    canvas,
    view
  );
  const north = atlasMapWorldToCanvasPoint(
    { x: 0, y: world.depth / 2 },
    world,
    canvas,
    view
  );
  const south = atlasMapWorldToCanvasPoint(
    { x: 0, y: -world.depth / 2 },
    world,
    canvas,
    view
  );

  return {
    minX: Math.min(west.x, east.x),
    maxX: Math.max(west.x, east.x),
    minY: Math.min(north.y, south.y),
    maxY: Math.max(north.y, south.y)
  };
}

function clampOffsetForAxis(offset, min, max, size) {
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

function clampMapView(view, world, canvas) {
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

export function atlasMapWorldToCanvasPoint(point, world, canvas, view) {
  const frame = atlasFitFrame(world, canvas, view.fitMode);
  const base = {
    x: frame.x + ((point.x / world.width) + 0.5) * frame.width,
    // mapOrientation 契约：北 = -Z，所以 z 小 → canvas y 小（屏幕上方 = 北上）。
    y: frame.y + (point.y / world.depth + 0.5) * frame.height
  };
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
  const frame = atlasFitFrame(world, canvas, view.fitMode);

  return {
    x: (((base.x - frame.x) / frame.width) - 0.5) * world.width,
    // 反推：canvas y 小 → 北 (-Z)；canvas y 大 → 南 (+Z)。
    y: (((base.y - frame.y) / frame.height) - 0.5) * world.depth
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

export function panAtlasMap(state, delta, world, canvas) {
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

export function resetAtlasMapView(state) {
  const mapView = { ...DEFAULT_MAP_VIEW };

  if (state.mapView?.fitMode) {
    mapView.fitMode = state.mapView.fitMode;
  }

  return {
    ...state,
    mapView
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
  maxDistance = 14,
  options = {}
) {
  // 跟 atlasVisibleFeatures 在 drawOverviewMap 那边的过滤参数对齐：
  // 默认按 atlasMinimumDisplayPriority(scale) 过滤，避免渲染上看不见
  // 的低优先级 feature 仍然 clickable（codex 8c58368 P2 抓到 county 城
  // 市 priority 6 在 default scale 不画但点空白处仍弹出 card）。
  const visible = atlasVisibleFeatures(
    features,
    [...state.visibleLayerIds].map((id) => ({ id, defaultVisible: true })),
    {
      minDisplayPriority: options.minDisplayPriority ?? Number.NEGATIVE_INFINITY
    }
  );
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
