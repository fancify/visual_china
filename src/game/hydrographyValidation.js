import { missingDemTileWorldRects } from "./atlasRender.js";

const DEFAULT_OPTIONS = {
  minRiverAffinity: 0.18,
  maxSlope: 0.82
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sampleChannel(asset, channel, point) {
  const data = asset[channel];
  const { columns, rows } = asset.grid;
  const halfWidth = asset.world.width * 0.5;
  const halfDepth = asset.world.depth * 0.5;
  const u = clamp((point.x + halfWidth) / asset.world.width, 0, 1);
  const v = clamp((halfDepth - point.y) / asset.world.depth, 0, 1);
  const gx = u * (columns - 1);
  const gy = v * (rows - 1);
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const x1 = Math.min(columns - 1, x0 + 1);
  const y1 = Math.min(rows - 1, y0 + 1);
  const tx = gx - x0;
  const ty = gy - y0;
  const index = (x, y) => y * columns + x;
  const top = data[index(x0, y0)] * (1 - tx) + data[index(x1, y0)] * tx;
  const bottom = data[index(x0, y1)] * (1 - tx) + data[index(x1, y1)] * tx;

  return top * (1 - ty) + bottom * ty;
}

function sampleSlope(asset, point) {
  const delta = 0.75;
  const dx =
    sampleChannel(asset, "heights", { x: point.x + delta, y: point.y }) -
    sampleChannel(asset, "heights", { x: point.x - delta, y: point.y });
  const dy =
    sampleChannel(asset, "heights", { x: point.x, y: point.y + delta }) -
    sampleChannel(asset, "heights", { x: point.x, y: point.y - delta });

  return Math.min(Math.hypot(dx, dy) / 4.2, 1);
}

function containingMissingTiles(point, demAsset) {
  return missingDemTileWorldRects(demAsset)
    .filter((rect) =>
      point.x >= rect.minX &&
      point.x <= rect.maxX &&
      point.y >= rect.minY &&
      point.y <= rect.maxY
    )
    .map((rect) => rect.tileName);
}

export function hydrographyPointDemDiagnostics(point, demAsset, options = {}) {
  const thresholds = { ...DEFAULT_OPTIONS, ...options };
  const riverAffinity = sampleChannel(demAsset, "riverMask", point);
  const height = sampleChannel(demAsset, "heights", point);
  const slope = sampleSlope(demAsset, point);
  const missingTileNames = containingMissingTiles(point, demAsset);
  const issues = [];

  if (riverAffinity < thresholds.minRiverAffinity) {
    issues.push("low-river-affinity");
  }

  if (slope > thresholds.maxSlope) {
    issues.push("steep-dem-slope");
  }

  if (missingTileNames.length > 0) {
    issues.push("interpolated-dem-tile");
  }

  return {
    x: Number(point.x.toFixed(3)),
    y: Number(point.y.toFixed(3)),
    height: Number(height.toFixed(3)),
    riverAffinity: Number(riverAffinity.toFixed(4)),
    slope: Number(slope.toFixed(4)),
    missingTileNames,
    issues
  };
}

export function validateHydrographyAgainstDem(features, demAsset, options = {}) {
  const diagnostics = features.map((feature) => {
    const points = feature.geometry.points.map((point, pointIndex) => ({
      pointIndex,
      ...hydrographyPointDemDiagnostics(point, demAsset, options)
    }));
    const problemPoints = points.filter((point) => point.issues.length > 0).length;

    return {
      featureId: feature.id,
      name: feature.name,
      rank: feature.rank,
      pointCount: points.length,
      problemPoints,
      points
    };
  });
  const problemPoints = diagnostics.reduce(
    (total, feature) => total + feature.problemPoints,
    0
  );
  const totalPoints = diagnostics.reduce(
    (total, feature) => total + feature.pointCount,
    0
  );
  const issueCounts = {};

  diagnostics.forEach((feature) => {
    feature.points.forEach((point) => {
      point.issues.forEach((issue) => {
        issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
      });
    });
  });

  return {
    schema: "visual-china.hydrography-dem-validation.v1",
    summary: {
      featureCount: diagnostics.length,
      totalPoints,
      problemPoints,
      issueCounts
    },
    features: diagnostics
  };
}
