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
