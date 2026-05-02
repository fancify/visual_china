export function isRenderableWaterFeature(feature) {
  if (feature.layer !== "water" || feature.geometry !== "polyline") {
    return false;
  }

  if (!feature.world?.points || feature.world.points.length < 2) {
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
  features,
  { maxFeatures = 24, minDisplayPriority = 9 } = {}
) {
  return features
    .filter(isRenderableWaterFeature)
    .filter((feature) => feature.displayPriority >= minDisplayPriority)
    .toSorted((a, b) => b.displayPriority - a.displayPriority)
    .slice(0, maxFeatures);
}

export function waterLabelPoint(feature) {
  const points = feature.world?.points ?? [];

  if (points.length === 0) {
    return null;
  }

  const index = Math.floor(points.length * 0.62);
  return points[Math.min(points.length - 1, Math.max(0, index))];
}

function normalize2D(x, y) {
  const length = Math.hypot(x, y);

  if (length === 0) {
    return { x: 0, y: 0 };
  }

  return { x: x / length, y: y / length };
}

function segmentNormal(start, end) {
  const direction = normalize2D(end.x - start.x, end.y - start.y);

  return {
    x: -direction.y,
    y: direction.x
  };
}

function pointNormal(points, index) {
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

function waterRibbonCrossSection(point, normal, halfWidth, y) {
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

export function buildWaterRibbonVertices(points, options) {
  if (points.length < 2) {
    return new Float32Array();
  }

  const halfWidth = options.width * 0.5;
  const yOffset = options.yOffset ?? 0;
  // Slope-aware Y：每个截面对中心、左、右三点采样，取最大地形高度。
  // 这样在 cross-slope 上 ribbon 也始终高出 upslope 一侧地表，避免低
  // yOffset（贴地）时被山坡淹掉（codex a75386c review 抓到 66/1278 顶
  // 点扎进地形的问题）。
  const sections = points.map((point, index) => {
    const normal = pointNormal(points, index);
    const leftX = point.x + normal.x * halfWidth;
    const leftZ = point.y + normal.y * halfWidth;
    const rightX = point.x - normal.x * halfWidth;
    const rightZ = point.y - normal.y * halfWidth;
    const maxTerrain = Math.max(
      options.sampleHeight(point.x, point.y),
      options.sampleHeight(leftX, leftZ),
      options.sampleHeight(rightX, rightZ)
    );
    return waterRibbonCrossSection(point, normal, halfWidth, maxTerrain + yOffset);
  });
  const vertices = [];
  const pushVertex = (point) => {
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

function clamp01(value) {
  return Math.min(1, Math.max(0, value));
}

function pseudoRandom(seed) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function segmentDistance(point, start, end) {
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

// waterRadius / bankRadius 跟着 ribbonWidth 一路收窄：
//   原始 ribbon 2.8m → waterRadius 1.6 / bankRadius 6.2
//   收窄 ribbon 1.6m → waterRadius 1.0 / bankRadius 5.0
//   再收窄到 ribbon 1.0m，waterRadius 也得跟到 ~0.55，否则水色会渲染到
//   ribbon footprint 外两倍宽（codex a75386c review 抓到 593/1166 顶
//   点超出 ribbon footprint）。bankRadius 不必跟着等比例缩小——它代表
//   "湿润植被带"，本来就比可见 ribbon 宽 5-10 倍。
export function riverCorridorInfluenceAtPoint(
  x,
  z,
  features,
  { waterRadius = 0.55, bankRadius = 5.0 } = {}
) {
  let distance = Infinity;

  features.filter(isRenderableWaterFeature).forEach((feature) => {
    const points = feature.world.points;

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
  features,
  { maxSamples = 420, spacing = 3.6, bankOffset = 2.8 } = {}
) {
  const samples = [];
  const renderableFeatures = selectRenderableWaterFeatures(features);

  renderableFeatures.forEach((feature, featureIndex) => {
    const points = feature.world.points;
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

export function waterVisualStyle(feature) {
  const major = feature.displayPriority >= 9;

  // 简化为单层 ribbon：用户反馈"中间反光白条很奇怪"——之前 ribbon /
  // highlight / line 三层叠出"内白外蓝"是反方向的（参考图是内白外蓝
  // 描边），干脆删掉 highlight 和 line 两层不再要反光，只留主带。
  // ribbonWidth 1.6/0.85 → 1.0/0.55（再窄 ~38%），
  // ribbonYOffset 1.5/1.0 → 0.3/0.2（贴地，配合 polygonOffset 防 z-fight）。
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

export function waterEnvironmentVisualStyle(style, visuals = {}) {
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
