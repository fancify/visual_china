import type { QinlingAtlasFeature } from "./qinlingAtlas.js";

export interface WaterRibbonPoint {
  x: number;
  y: number;
}

export interface WaterRibbonOptions {
  width: number;
  yOffset?: number;
  /** 折线密化最大段长（默认 0.9，支流可传 1.5 节省顶点） */
  maxSegmentLength?: number;
  sampleHeight(x: number, z: number): number;
}

export interface WaterRibbonAlphaOptions {
  /** 必须跟 buildWaterRibbonVertices 一致，保证顶点数对齐 */
  maxSegmentLength?: number;
  /** 起点 alpha (1 = 不透明，0 = 完全透明). 默认 1 */
  fadeStartAlpha?: number;
  /** 终点 alpha. 默认 1 */
  fadeEndAlpha?: number;
  /** fade 段在 polyline 头/尾占的比例. 默认 0.08 */
  fadeFraction?: number;
  /** 中段 alpha (默认 1) */
  baseOpacity?: number;
}

export interface CorridorInfluence {
  water: number;
  bank: number;
  vegetation: number;
  distance: number;
}

export interface RiverVegetationSample {
  featureId: string;
  x: number;
  z: number;
  rotation: number;
  scale: number;
  variant: "tree" | "shrub";
}

export interface WaterVisualStyle {
  bankWidth: number;
  bankYOffset: number;
  bankOpacity: number;
  ribbonWidth: number;
  ribbonYOffset: number;
  ribbonOpacity: number;
  depthTest: boolean;
}

export interface WaterEnvironmentVisuals {
  daylight?: number;
  waterShimmer?: number;
  ambientIntensity?: number;
  sunIntensity?: number;
  moonOpacity?: number;
  fogDensity?: number;
  mistOpacity?: number;
  precipitationOpacity?: number;
}

export interface WaterEnvironmentVisualStyle {
  bankOpacity: number;
  ribbonOpacity: number;
  colorMultiplier: number;
}

// QinlingAtlasFeature.world is QinlingAtlasPoint | { points: QinlingAtlasPoint[] } — for
// polyline features (the ones this module handles) it's always the latter. Narrow once here.
function asPolylineWorld(world: QinlingAtlasFeature["world"]): { points: WaterRibbonPoint[] } | null {
  if (world && typeof world === "object" && "points" in world && Array.isArray((world as any).points)) {
    return world as { points: WaterRibbonPoint[] };
  }
  return null;
}

export function isRenderableWaterFeature(feature: QinlingAtlasFeature): boolean {
  if (feature.layer !== "water" || feature.geometry !== "polyline") {
    return false;
  }

  const polyline = asPolylineWorld(feature.world);
  if (!polyline || polyline.points.length < 2) {
    return false;
  }

  if (feature.source?.name === "curated-modern-qinling") {
    return feature.displayPriority >= 3;
  }

  if (feature.source?.name === "primary-modern-qinling") {
    return (
      feature.displayPriority >= 8 &&
      (
        feature.source?.verification === "external-vector" ||
        feature.source?.verification === "verified"
      )
    );
  }

  if (
    feature.source?.name !== "openstreetmap-overpass" &&
    (
      feature.source?.verification === "external-vector" ||
      feature.source?.verification === "verified"
    )
  ) {
    return feature.displayPriority >= 8;
  }

  return false;
}

export function selectRenderableWaterFeatures(
  features: QinlingAtlasFeature[],
  { maxFeatures = 24, minDisplayPriority = 9 }: { maxFeatures?: number; minDisplayPriority?: number } = {}
): QinlingAtlasFeature[] {
  return features
    .filter(isRenderableWaterFeature)
    .filter((feature) => feature.displayPriority >= minDisplayPriority)
    .toSorted((a, b) => b.displayPriority - a.displayPriority)
    .slice(0, maxFeatures);
}

export function waterLabelPoint(feature: QinlingAtlasFeature): WaterRibbonPoint | null {
  const polyline = asPolylineWorld(feature.world);
  const points = polyline?.points ?? [];

  if (points.length === 0) {
    return null;
  }

  const index = Math.floor(points.length * 0.62);
  return points[Math.min(points.length - 1, Math.max(0, index))];
}

function normalize2D(x: number, y: number): { x: number; y: number } {
  const length = Math.hypot(x, y);

  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return { x: x / length, y: y / length };
}

function segmentNormal(start: WaterRibbonPoint, end: WaterRibbonPoint): { x: number; y: number } {
  const direction = normalize2D(end.x - start.x, end.y - start.y);

  return {
    x: -direction.y,
    y: direction.x
  };
}

function pointNormal(points: WaterRibbonPoint[], index: number): { x: number; y: number } {
  if (points.length < 2) {
    return { x: 0, y: 1 };
  }

  if (index === 0) {
    return segmentNormal(points[0], points[1]);
  }

  if (index === points.length - 1) {
    return segmentNormal(points[index - 1], points[index]);
  }

  const previous = segmentNormal(points[index - 1], points[index]);
  const next = segmentNormal(points[index], points[index + 1]);
  const normal = normalize2D(previous.x + next.x, previous.y + next.y);

  if (normal.x === 0 && normal.y === 0) {
    return next;
  }

  return normal;
}

function waterRibbonCrossSection(
  point: WaterRibbonPoint,
  normal: { x: number; y: number },
  halfWidth: number,
  y: number
): {
  left: { x: number; y: number; z: number };
  right: { x: number; y: number; z: number };
} {
  return {
    left: {
      x: point.x + normal.x * halfWidth,
      y,
      z: point.y + normal.y * halfWidth
    },
    right: {
      x: point.x - normal.x * halfWidth,
      y,
      z: point.y - normal.y * halfWidth
    }
  };
}

// 把折线密化：每段切到不超过 maxSegmentLength 长度。这样每个 cross-
// section 都能 sample 到自己当地的地形高度，避免长段在中段凹陷处低于
// 地形。
export function densifyPolyline(
  points: WaterRibbonPoint[],
  maxSegmentLength: number
): WaterRibbonPoint[] {
  if (points.length < 2) return points.slice();
  const result: WaterRibbonPoint[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    const segLen = Math.hypot(b.x - a.x, b.y - a.y);
    const subdivisions = Math.max(1, Math.ceil(segLen / maxSegmentLength));
    for (let j = 0; j < subdivisions; j += 1) {
      const t = j / subdivisions;
      result.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
    }
  }
  result.push(points[points.length - 1]);
  return result;
}

export function buildWaterRibbonVertices(
  points: WaterRibbonPoint[],
  options: WaterRibbonOptions
): Float32Array {
  if (points.length < 2) {
    return new Float32Array();
  }

  const halfWidth = options.width * 0.5;
  const yOffset = options.yOffset ?? 0;
  points = densifyPolyline(points, options.maxSegmentLength ?? 0.9);
  // Slope-aware Y（capped lift, never below center）：避免深刻河床上 ribbon 飞到岸顶。
  const maxLift = 0.6;
  const normals = points.map((_, i) => pointNormal(points, i));
  const rawCenters = points.map((p) => options.sampleHeight(p.x, p.y));
  const rawLefts = points.map((p, i) => {
    const n = normals[i];
    return options.sampleHeight(p.x + n.x * halfWidth, p.y + n.y * halfWidth);
  });
  const rawRights = points.map((p, i) => {
    const n = normals[i];
    return options.sampleHeight(p.x - n.x * halfWidth, p.y - n.y * halfWidth);
  });
  const smooth = (arr: number[]): number[] =>
    arr.map((_, i) => {
      let sum = 0;
      let count = 0;
      for (let k = -2; k <= 2; k += 1) {
        const j = i + k;
        if (j < 0 || j >= arr.length) continue;
        sum += arr[j];
        count += 1;
      }
      return sum / count;
    });
  const sCenters = smooth(rawCenters);
  const sLefts = smooth(rawLefts);
  const sRights = smooth(rawRights);
  const sections = points.map((point, index) => {
    const normal = normals[index];
    const yCenter = sCenters[index];
    const upslope = Math.max(sLefts[index], sRights[index]);
    const liftAmount = Math.min(Math.max(0, upslope - yCenter), maxLift);
    return waterRibbonCrossSection(point, normal, halfWidth, yCenter + liftAmount + yOffset);
  });
  const vertices: number[] = [];
  const pushVertex = (point: { x: number; y: number; z: number }) => {
    vertices.push(point.x, point.y, point.z);
  };

  for (let index = 0; index < sections.length - 1; index += 1) {
    const start = sections[index];
    const end = sections[index + 1];

    pushVertex(start.left);
    pushVertex(start.right);
    pushVertex(end.left);
    pushVertex(start.right);
    pushVertex(end.right);
    pushVertex(end.left);
  }

  return new Float32Array(vertices);
}

// 配套的 per-vertex alpha 数组，跟 buildWaterRibbonVertices 的 vertex 顺序一致。
export function buildWaterRibbonAlphas(
  points: WaterRibbonPoint[],
  options: WaterRibbonAlphaOptions
): Float32Array {
  const fadeFraction = options.fadeFraction ?? 0.08;
  const startAlpha = options.fadeStartAlpha ?? 1.0;
  const endAlpha = options.fadeEndAlpha ?? 1.0;
  const baseOpacity = options.baseOpacity ?? 1.0;
  const densified = densifyPolyline(points, options.maxSegmentLength ?? 0.9);
  const sectionCount = densified.length;
  if (sectionCount < 2) return new Float32Array();
  const fadePoints = Math.max(1, Math.round(sectionCount * fadeFraction));
  const sectionAlpha = new Array(sectionCount);
  for (let i = 0; i < sectionCount; i += 1) {
    let a = baseOpacity;
    if (startAlpha < 1 && i < fadePoints) {
      const t = i / fadePoints;
      a = startAlpha + (baseOpacity - startAlpha) * t;
    }
    if (endAlpha < 1 && i >= sectionCount - fadePoints) {
      const t = (sectionCount - 1 - i) / fadePoints;
      const tail = endAlpha + (baseOpacity - endAlpha) * t;
      a = Math.min(a, tail);
    }
    sectionAlpha[i] = a;
  }
  const out = new Float32Array((sectionCount - 1) * 6);
  let cursor = 0;
  for (let i = 0; i < sectionCount - 1; i += 1) {
    const aS = sectionAlpha[i];
    const aE = sectionAlpha[i + 1];
    out[cursor++] = aS;
    out[cursor++] = aS;
    out[cursor++] = aE;
    out[cursor++] = aS;
    out[cursor++] = aE;
    out[cursor++] = aE;
  }
  return out;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function segmentDistance(
  point: { x: number; z: number },
  start: WaterRibbonPoint,
  end: WaterRibbonPoint
): number {
  const dx = end.x - start.x;
  const dz = end.y - start.y;
  const lengthSquared = dx * dx + dz * dz;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - start.x, point.z - start.y);
  }

  const t = clamp01(
    ((point.x - start.x) * dx + (point.z - start.y) * dz) / lengthSquared
  );
  const closestX = start.x + dx * t;
  const closestZ = start.y + dz * t;

  return Math.hypot(point.x - closestX, point.z - closestZ);
}

export function riverCorridorInfluenceAtPoint(
  x: number,
  z: number,
  features: QinlingAtlasFeature[],
  { waterRadius = 0.55, bankRadius = 5.0 }: { waterRadius?: number; bankRadius?: number } = {}
): CorridorInfluence {
  let distance = Infinity;

  features.filter(isRenderableWaterFeature).forEach((feature) => {
    const points = (feature.world as { points: WaterRibbonPoint[] }).points;

    for (let index = 0; index < points.length - 1; index += 1) {
      distance = Math.min(
        distance,
        segmentDistance({ x, z }, points[index], points[index + 1])
      );
    }
  });

  if (!Number.isFinite(distance) || distance > bankRadius) {
    return {
      water: 0,
      bank: 0,
      vegetation: 0,
      distance: Infinity
    };
  }

  const water = clamp01(1 - distance / waterRadius);
  const bank = clamp01(1 - Math.max(0, distance - waterRadius * 0.5) / bankRadius);
  const bankCenter = waterRadius + (bankRadius - waterRadius) * 0.42;
  const vegetation = clamp01(1 - Math.abs(distance - bankCenter) / (bankRadius * 0.48));

  return {
    water,
    bank,
    vegetation,
    distance
  };
}

export function buildRiverVegetationSamples(
  features: QinlingAtlasFeature[],
  { maxSamples = 420, spacing = 3.6, bankOffset = 2.8, minDisplayPriority = 9 }: {
    maxSamples?: number;
    spacing?: number;
    bankOffset?: number;
    minDisplayPriority?: number;
  } = {}
): RiverVegetationSample[] {
  const samples: RiverVegetationSample[] = [];
  const renderableFeatures = selectRenderableWaterFeatures(features, { minDisplayPriority });

  renderableFeatures.forEach((feature, featureIndex) => {
    const points = (feature.world as { points: WaterRibbonPoint[] }).points;
    const style = waterVisualStyle(feature);

    for (let index = 0; index < points.length - 1; index += 1) {
      const start = points[index];
      const end = points[index + 1];
      const dx = end.x - start.x;
      const dz = end.y - start.y;
      const length = Math.hypot(dx, dz);

      if (length < 0.01) {
        continue;
      }

      const normalX = -dz / length;
      const normalZ = dx / length;
      const segmentSamples = Math.max(1, Math.floor(length / spacing));

      for (let step = 0; step < segmentSamples; step += 1) {
        if (samples.length >= maxSamples) {
          return samples;
        }

        const seed = featureIndex * 997 + index * 53 + step * 17;
        const t = (step + 0.5) / segmentSamples;
        const side = (step + index) % 2 === 0 ? 1 : -1;
        const jitterAlong = (pseudoRandom(seed + 3) - 0.5) * spacing * 0.42;
        const jitterBank = (pseudoRandom(seed + 7) - 0.5) * 1.1;
        const offset = side * (style.ribbonWidth * 0.58 + bankOffset + jitterBank);
        const centerX = start.x + dx * t + (dx / length) * jitterAlong;
        const centerZ = start.y + dz * t + (dz / length) * jitterAlong;

        samples.push({
          featureId: feature.id,
          x: centerX + normalX * offset,
          z: centerZ + normalZ * offset,
          rotation: Math.atan2(normalX * side, normalZ * side),
          scale: 0.45 + pseudoRandom(seed + 11) * 0.72,
          variant: pseudoRandom(seed + 19) > 0.38 ? "tree" : "shrub"
        });
      }
    }
  });

  return samples;
}

export function waterVisualStyle(feature: QinlingAtlasFeature): WaterVisualStyle {
  const major = feature.displayPriority >= 9;

  return {
    bankWidth: major ? 4.4 : 3.2,
    bankYOffset: major ? 0.12 : 0.1,
    bankOpacity: major ? 0.24 : 0.18,
    ribbonWidth: major ? 1.0 : 0.55,
    ribbonYOffset: major ? 0.3 : 0.2,
    ribbonOpacity: major ? 0.92 : 0.78,
    depthTest: true
  };
}

export function waterEnvironmentVisualStyle(
  style: WaterVisualStyle,
  visuals: WaterEnvironmentVisuals = {}
): WaterEnvironmentVisualStyle {
  const daylight = clamp01(visuals.daylight ?? 1);
  const shimmer = clamp01(visuals.waterShimmer ?? 0.62);
  const moon = clamp01(visuals.moonOpacity ?? 0);
  const sun = clamp01((visuals.sunIntensity ?? 2.8) / 2.8);
  const ambient = clamp01(((visuals.ambientIntensity ?? 1.7) - 1.1) / 0.65);
  const weatherDim = clamp01(
    (visuals.precipitationOpacity ?? 0) * 0.28 +
    (visuals.mistOpacity ?? 0) * 3.0 +
    (visuals.fogDensity ?? 0) * 18
  );
  const light = clamp01(
    daylight * 0.66 +
    sun * 0.16 +
    ambient * 0.08 +
    moon * 0.22 +
    0.08
  );
  const ribbonMultiplier = clamp01(0.3 + light * 0.62 + shimmer * 0.12 - weatherDim * 0.22);
  const colorMultiplier = Math.max(
    0.28,
    Math.min(1, 0.26 + light * 0.72 + moon * 0.08 - weatherDim * 0.24)
  );

  return {
    bankOpacity: style.bankOpacity * Math.max(0.35, ribbonMultiplier * 0.82),
    ribbonOpacity: style.ribbonOpacity * Math.max(0.28, ribbonMultiplier),
    colorMultiplier
  };
}
