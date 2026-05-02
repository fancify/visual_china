import { projectWorldToAtlasPixel } from "./mapOrientation.js";

// 跟 qinlingAtlasLayers 对齐：水系 → 城市 → 关隘 → 名胜 → 考古 → 民生。
// 底色（水系）先画，点状叙事节点（关隘 / 名胜 / 考古 / 民生）后画压在城市之上。
export const atlasLayerDrawOrder = [
  "water",
  "city",
  "pass",
  "scenic",
  "ancient",
  "livelihood"
];

/**
 * 把世界 (x, z) 点投影到 atlas overview 画布像素。
 * Atlas feature 的 world 字段历史上把世界 z 存在 `.y` 上，因此这里先把
 * `point.y` 作为 z 喂给统一契约函数。
 */
export function worldPointToOverviewPixel(point, world, canvas) {
  return projectWorldToAtlasPixel(
    { x: point.x, z: point.y },
    world,
    canvas
  );
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
    return 9;
  }

  if (scale >= 2) {
    return 4;
  }

  if (scale >= 1.45) {
    return 7;
  }

  return 9;
}

export function isVerifiedAtlasFeature(feature) {
  return (
    feature.source?.verification === "external-vector" ||
    feature.source?.verification === "verified"
  );
}

export function isRawEvidenceAtlasFeature(feature) {
  return (
    feature.source?.name === "openstreetmap-overpass" ||
    feature.themes?.includes("evidence") ||
    feature.terrainRole?.includes("evidence")
  );
}

export function atlasVisibleFeatures(features, layers, options = {}) {
  const visibleLayerIds = new Set(
    layers.filter((layer) => layer.defaultVisible).map((layer) => layer.id)
  );
  const minDisplayPriority = options.minDisplayPriority ?? Number.NEGATIVE_INFINITY;
  const includeUnverifiedFeatures = options.includeUnverifiedFeatures === true;
  const includeEvidenceFeatures = options.includeEvidenceFeatures === true;
  const order = new Map(
    atlasLayerDrawOrder.map((layerId, index) => [layerId, index])
  );

  return features
    .filter((feature) => visibleLayerIds.has(feature.layer))
    .filter((feature) => feature.displayPriority >= minDisplayPriority)
    .filter((feature) =>
      includeUnverifiedFeatures ||
      isVerifiedAtlasFeature(feature)
    )
    .filter((feature) =>
      includeEvidenceFeatures ||
      !isRawEvidenceAtlasFeature(feature)
    )
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
