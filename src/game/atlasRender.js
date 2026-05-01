export const atlasLayerDrawOrder = [
  "landform",
  "water",
  "road",
  "city",
  "pass",
  "military",
  "livelihood",
  "culture"
];

export function worldPointToOverviewPixel(point, world, canvas) {
  return {
    x: ((point.x / world.width) + 0.5) * canvas.width,
    y: (0.5 - point.y / world.depth) * canvas.height
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function atlasCanvasPoint(point, world, canvas) {
  const pixel = worldPointToOverviewPixel(point, world, canvas);

  return {
    x: clamp(pixel.x, 0, canvas.width),
    y: clamp(pixel.y, 0, canvas.height)
  };
}

export function atlasVisibleFeatures(features, layers) {
  const visibleLayerIds = new Set(
    layers.filter((layer) => layer.defaultVisible).map((layer) => layer.id)
  );
  const order = new Map(
    atlasLayerDrawOrder.map((layerId, index) => [layerId, index])
  );

  return features
    .filter((feature) => visibleLayerIds.has(feature.layer))
    .toSorted((a, b) => {
      const layerDelta = (order.get(a.layer) ?? 99) - (order.get(b.layer) ?? 99);

      if (layerDelta !== 0) {
        return layerDelta;
      }

      return b.displayPriority - a.displayPriority;
    });
}

export function featureWorldPoints(feature) {
  if ("points" in feature.world) {
    return feature.world.points;
  }

  return [feature.world];
}

export function atlasFeatureCenter(feature, world, canvas) {
  const points = featureWorldPoints(feature);
  const sum = points.reduce(
    (total, point) => ({
      x: total.x + point.x,
      y: total.y + point.y
    }),
    { x: 0, y: 0 }
  );

  return atlasCanvasPoint(
    {
      x: sum.x / points.length,
      y: sum.y / points.length
    },
    world,
    canvas
  );
}
