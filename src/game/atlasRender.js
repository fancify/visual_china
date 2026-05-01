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

function parseFabdemTileName(fileName) {
  const match = fileName.match(/([NS])(\d{2})([EW])(\d{3})_FABDEM_V1-2\.tif$/);

  if (!match) {
    return null;
  }

  const [, latHemisphere, latRaw, lonHemisphere, lonRaw] = match;
  const south = Number(latRaw) * (latHemisphere === "S" ? -1 : 1);
  const west = Number(lonRaw) * (lonHemisphere === "W" ? -1 : 1);

  return {
    south,
    north: south + 1,
    west,
    east: west + 1
  };
}

function intersectBounds(a, b) {
  const west = Math.max(a.west, b.west);
  const east = Math.min(a.east, b.east);
  const south = Math.max(a.south, b.south);
  const north = Math.min(a.north, b.north);

  if (west >= east || south >= north) {
    return null;
  }

  return { west, east, south, north };
}

export function atlasCanvasPoint(point, world, canvas) {
  const pixel = worldPointToOverviewPixel(point, world, canvas);

  return {
    x: clamp(pixel.x, 0, canvas.width),
    y: clamp(pixel.y, 0, canvas.height)
  };
}

export function parseMissingDemTileNames(notes = []) {
  return notes
    .flatMap((note) => note.match(/[NS]\d{2}[EW]\d{3}_FABDEM_V1-2\.tif/g) ?? [])
    .filter((tileName, index, list) => list.indexOf(tileName) === index);
}

export function missingDemTileWorldRects(asset) {
  if (!asset?.bounds || !asset?.world) {
    return [];
  }

  const tileNames = parseMissingDemTileNames(asset.notes ?? []);
  const lonRange = asset.bounds.east - asset.bounds.west || 1;
  const latRange = asset.bounds.north - asset.bounds.south || 1;

  return tileNames.flatMap((tileName) => {
    const tileBounds = parseFabdemTileName(tileName);
    const clipped = tileBounds ? intersectBounds(tileBounds, asset.bounds) : null;

    if (!clipped) {
      return [];
    }

    return [{
      tileName,
      minX: ((clipped.west - asset.bounds.west) / lonRange - 0.5) * asset.world.width,
      maxX: ((clipped.east - asset.bounds.west) / lonRange - 0.5) * asset.world.width,
      minY: ((clipped.south - asset.bounds.south) / latRange - 0.5) * asset.world.depth,
      maxY: ((clipped.north - asset.bounds.south) / latRange - 0.5) * asset.world.depth
    }];
  });
}

export function atlasMinimumDisplayPriority({ fullscreen = false, scale = 1 } = {}) {
  if (!fullscreen) {
    return 7;
  }

  if (scale >= 4) {
    return 2;
  }

  if (scale >= 2) {
    return 4;
  }

  return 7;
}

export function atlasVisibleFeatures(features, layers, options = {}) {
  const visibleLayerIds = new Set(
    layers.filter((layer) => layer.defaultVisible).map((layer) => layer.id)
  );
  const minDisplayPriority = options.minDisplayPriority ?? Number.NEGATIVE_INFINITY;
  const order = new Map(
    atlasLayerDrawOrder.map((layerId, index) => [layerId, index])
  );

  return features
    .filter((feature) => visibleLayerIds.has(feature.layer))
    .filter((feature) => feature.displayPriority >= minDisplayPriority)
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
