import { projectWorldToAtlasPixel } from "./mapOrientation.js";
import type {
  QinlingAtlasFeature,
  QinlingAtlasLayer,
  QinlingAtlasLayerId,
  QinlingAtlasPoint
} from "./qinlingAtlas.js";

interface WorldDims {
  width: number;
  depth: number;
}

interface CanvasDims {
  width: number;
  height: number;
}

// 跟 qinlingAtlasLayers 对齐：水系 → 城市 → 关隘 → 名胜 → 考古 → 民生。
// 底色（水系）先画，点状叙事节点（关隘 / 名胜 / 考古 / 民生）后画压在城市之上。
export const atlasLayerDrawOrder: QinlingAtlasLayerId[] = [
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
export function worldPointToOverviewPixel(
  point: QinlingAtlasPoint,
  world: WorldDims,
  canvas: CanvasDims
): QinlingAtlasPoint {
  return projectWorldToAtlasPixel(
    { x: point.x, z: point.y },
    world,
    canvas
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function atlasCanvasPoint(
  point: QinlingAtlasPoint,
  world: WorldDims,
  canvas: CanvasDims
): QinlingAtlasPoint {
  const pixel = worldPointToOverviewPixel(point, world, canvas);

  return {
    x: clamp(pixel.x, 0, canvas.width),
    y: clamp(pixel.y, 0, canvas.height)
  };
}

export function parseMissingDemTileNames(notes: string[] = []): string[] {
  void notes;
  return [];
}

export function missingDemTileWorldRects(asset: {
  bounds?: { west: number; east: number; south: number; north: number };
  world?: { width: number; depth: number };
  notes?: string[];
}): Array<{
  tileName: string;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}> {
  void asset;
  return [];
}

export function atlasMinimumDisplayPriority(
  { fullscreen = false, scale = 1 }: { fullscreen?: boolean; scale?: number } = {}
): number {
  // 用户："mini-map 标签太密"。非全屏 mini-map 只保留 top 优先级（≥11，
  // 通常是首都/河流主干）。原 9 全国画幅下还是太多城市挤一团。
  if (!fullscreen) {
    return 11;
  }

  if (scale >= 2) {
    return 4;
  }

  if (scale >= 1.45) {
    return 7;
  }

  return 9;
}

export function isVerifiedAtlasFeature(feature: QinlingAtlasFeature): boolean {
  return (
    feature.source?.verification === "external-vector" ||
    feature.source?.verification === "verified"
  );
}

export function isRawEvidenceAtlasFeature(feature: QinlingAtlasFeature): boolean {
  return (
    feature.source?.name === "openstreetmap-overpass" ||
    (feature.themes?.includes("evidence") ?? false) ||
    (feature.terrainRole?.includes("evidence") ?? false)
  );
}

export function atlasVisibleFeatures(
  features: QinlingAtlasFeature[],
  layers: QinlingAtlasLayer[],
  options: {
    minDisplayPriority?: number;
    includeUnverifiedFeatures?: boolean;
    includeEvidenceFeatures?: boolean;
  } = {}
): QinlingAtlasFeature[] {
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

export function featureWorldPoints(feature: QinlingAtlasFeature): QinlingAtlasPoint[] {
  if ("points" in feature.world) {
    return feature.world.points;
  }

  return [feature.world as QinlingAtlasPoint];
}

export function atlasFeatureCenter(
  feature: Pick<QinlingAtlasFeature, "world">,
  world: WorldDims,
  canvas: CanvasDims
): QinlingAtlasPoint {
  const points = featureWorldPoints(feature as QinlingAtlasFeature);
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
