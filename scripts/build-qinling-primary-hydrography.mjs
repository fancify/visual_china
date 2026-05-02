import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const osmInputPath = path.resolve("public/data/regions/qinling/hydrography/osm-modern.json");
const curatedInputPath = path.resolve("public/data/regions/qinling/hydrography/modern.json");
const outputPath = path.resolve("public/data/regions/qinling/hydrography/primary-modern.json");

const PRIMARY_WATERWAYS = [
  {
    id: "river-weihe",
    displayName: "渭河",
    matchNames: ["渭河"],
    kind: "river",
    rank: 1,
    basin: "黄河流域",
    downstreamDirection: { x: 1, y: 0 }
  },
  {
    id: "river-hanjiang",
    displayName: "汉江",
    matchNames: ["汉江"],
    aliases: ["汉水"],
    kind: "river",
    rank: 1,
    basin: "长江流域",
    downstreamDirection: { x: 1, y: -0.2 }
  },
  {
    id: "river-jialingjiang",
    displayName: "嘉陵江",
    matchNames: ["嘉陵江"],
    kind: "river",
    rank: 1,
    basin: "长江流域",
    downstreamDirection: { x: 0.1, y: -1 }
  },
  {
    id: "river-jinghe",
    displayName: "泾河",
    matchNames: ["泾河"],
    kind: "river",
    rank: 2,
    basin: "黄河流域",
    componentAnchor: { x: 74, y: 88 },
    downstreamDirection: { x: 1, y: -0.6 }
  },
  {
    id: "river-fenghe",
    displayName: "沣河",
    matchNames: ["沣河"],
    kind: "river",
    rank: 2,
    basin: "黄河流域",
    downstreamDirection: { x: 0, y: 1 }
  },
  {
    id: "river-heihe",
    displayName: "黑河",
    matchNames: ["黑河"],
    kind: "river",
    rank: 2,
    basin: "黄河流域",
    componentAnchor: { x: 65, y: 56 },
    downstreamDirection: { x: 0.4, y: 1 }
  },
  {
    id: "river-laohe",
    displayName: "涝河",
    matchNames: ["涝河"],
    kind: "river",
    rank: 2,
    basin: "黄河流域",
    downstreamDirection: { x: 0, y: 1 }
  },
  {
    id: "river-baohe",
    displayName: "褒河",
    matchNames: ["褒河", "褒水"],
    aliases: ["褒水"],
    kind: "river",
    rank: 2,
    basin: "汉江流域",
    downstreamDirection: { x: 0, y: -1 }
  },
  {
    id: "river-west-hanshui",
    displayName: "西汉水",
    matchNames: ["西汉水"],
    kind: "river",
    rank: 2,
    basin: "嘉陵江流域",
    downstreamDirection: { x: 0.6, y: -1 }
  },
  {
    id: "river-mumahe",
    displayName: "牧马河",
    matchNames: ["牧马河"],
    kind: "river",
    rank: 2,
    basin: "汉江流域",
    downstreamDirection: { x: 1, y: 0.8 }
  },
  {
    id: "river-xushuihe",
    displayName: "湑水河",
    matchNames: ["湑水河"],
    kind: "stream",
    rank: 2,
    basin: "汉江流域",
    downstreamDirection: { x: -1, y: 0.6 }
  },
  {
    id: "river-xieshui",
    displayName: "斜水",
    matchNames: ["斜水", "斜江河"],
    aliases: ["斜江河"],
    kind: "stream",
    rank: 2,
    basin: "渭河流域",
    preferCuratedFallback: true,
    downstreamDirection: { x: -1, y: -1 },
    needsReview: true
  }
];

function labelsForFeature(feature) {
  return [feature.name, feature.displayName, ...(feature.aliases ?? [])].filter(Boolean);
}

function matchesConfig(feature, config) {
  const labels = labelsForFeature(feature);
  return config.matchNames.some((matchName) => labels.some((label) => label === matchName));
}

function keyForPoint(point) {
  return `${point.x.toFixed(3)},${point.y.toFixed(3)}`;
}

function dedupePoints(points) {
  const seen = new Set();
  const result = [];

  points.forEach((point) => {
    const key = keyForPoint(point);

    if (seen.has(key)) {
      return;
    }

    seen.add(key);
    result.push({ x: Number(point.x.toFixed(3)), y: Number(point.y.toFixed(3)) });
  });

  return result;
}

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function pathLength(points) {
  let total = 0;

  for (let index = 1; index < points.length; index += 1) {
    total += pointDistance(points[index - 1], points[index]);
  }

  return total;
}

function dedupeConsecutivePoints(points) {
  const result = [];

  points.forEach((point) => {
    const rounded = { x: Number(point.x.toFixed(3)), y: Number(point.y.toFixed(3)) };
    const previous = result.at(-1);

    if (!previous || pointDistance(previous, rounded) > 0.001) {
      result.push(rounded);
    }
  });

  return result;
}

function simplifyLineByDistance(points, maxPoints = 72) {
  const line = dedupeConsecutivePoints(points);

  if (line.length <= maxPoints) {
    return line;
  }

  const distances = [0];

  for (let index = 1; index < line.length; index += 1) {
    distances.push(distances[index - 1] + pointDistance(line[index - 1], line[index]));
  }

  const totalDistance = distances.at(-1);
  const result = [];

  for (let index = 0; index < maxPoints; index += 1) {
    const target = (index / (maxPoints - 1)) * totalDistance;
    const segmentIndex = Math.min(
      distances.findIndex((distance) => distance >= target),
      line.length - 1
    );

    if (segmentIndex <= 0) {
      result.push(line[0]);
      continue;
    }

    const startDistance = distances[segmentIndex - 1];
    const endDistance = distances[segmentIndex];
    const t = (target - startDistance) / (endDistance - startDistance || 1);
    const start = line[segmentIndex - 1];
    const end = line[segmentIndex];

    result.push({
      x: Number((start.x + (end.x - start.x) * t).toFixed(3)),
      y: Number((start.y + (end.y - start.y) * t).toFixed(3))
    });
  }

  return dedupePoints(result);
}

function featureEndpoints(feature) {
  const points = feature.geometry.points ?? [];
  return [points[0], points.at(-1)];
}

function endpointDistance(a, b) {
  return Math.min(
    pointDistance(a[0], b[0]),
    pointDistance(a[0], b[1]),
    pointDistance(a[1], b[0]),
    pointDistance(a[1], b[1])
  );
}

function connectedComponents(features, tolerance = 0.45) {
  const candidates = features.filter((feature) => (feature.geometry.points ?? []).length >= 2);
  const seen = new Set();
  const components = [];

  candidates.forEach((feature, startIndex) => {
    if (seen.has(startIndex)) {
      return;
    }

    const queue = [startIndex];
    const component = [];
    seen.add(startIndex);

    while (queue.length > 0) {
      const index = queue.shift();
      const current = candidates[index];
      const currentEndpoints = featureEndpoints(current);
      component.push(current);

      candidates.forEach((candidate, candidateIndex) => {
        if (seen.has(candidateIndex)) {
          return;
        }

        if (endpointDistance(currentEndpoints, featureEndpoints(candidate)) <= tolerance) {
          seen.add(candidateIndex);
          queue.push(candidateIndex);
        }
      });
    }

    component.sort((a, b) => pathLength(b.geometry.points) - pathLength(a.geometry.points));
    components.push(component);
  });

  return components;
}

function componentLength(component) {
  return component.reduce((total, feature) => total + pathLength(feature.geometry.points), 0);
}

function componentAnchorDistance(component, anchor) {
  return Math.min(
    ...component.flatMap((feature) =>
      feature.geometry.points.map((point) => pointDistance(point, anchor))
    )
  );
}

function selectBestComponent(config, components) {
  return components
    .map((component) => {
      const length = componentLength(component);
      const anchorPenalty = config.componentAnchor
        ? componentAnchorDistance(component, config.componentAnchor) * 4
        : 0;

      return { component, score: length - anchorPenalty };
    })
    .toSorted((a, b) => b.score - a.score)[0]?.component ?? [];
}

function joinComponentWays(component, tolerance = 0.7) {
  if (component.length === 0) {
    return [];
  }

  const unused = new Set(component.map((_, index) => index));
  const startIndex = component
    .map((feature, index) => ({ index, length: pathLength(feature.geometry.points) }))
    .toSorted((a, b) => b.length - a.length)[0].index;
  let chain = dedupeConsecutivePoints(component[startIndex].geometry.points);
  unused.delete(startIndex);

  while (unused.size > 0) {
    const head = chain[0];
    const tail = chain.at(-1);
    let best = null;

    unused.forEach((index) => {
      const points = dedupeConsecutivePoints(component[index].geometry.points);
      const first = points[0];
      const last = points.at(-1);
      const candidates = [
        { index, distance: pointDistance(tail, first), mode: "append-forward", points },
        { index, distance: pointDistance(tail, last), mode: "append-reverse", points },
        { index, distance: pointDistance(head, last), mode: "prepend-forward", points },
        { index, distance: pointDistance(head, first), mode: "prepend-reverse", points }
      ];

      candidates.forEach((candidate) => {
        if (candidate.distance > tolerance) {
          return;
        }

        if (!best || candidate.distance < best.distance) {
          best = candidate;
        }
      });
    });

    if (!best) {
      break;
    }

    const points = best.mode.endsWith("reverse")
      ? [...best.points].reverse()
      : best.points;

    if (best.mode.startsWith("append")) {
      chain = [...chain, ...points.slice(1)];
    } else {
      chain = [...points.slice(0, -1), ...chain];
    }

    unused.delete(best.index);
  }

  return chain;
}

function orientDownstream(points, direction) {
  if (!direction || points.length < 2) {
    return points;
  }

  const start = points[0];
  const end = points.at(-1);
  const dot = (end.x - start.x) * direction.x + (end.y - start.y) * direction.y;

  return dot < 0 ? [...points].reverse() : points;
}

function curatedFallback(config, curatedFeatures) {
  const feature = curatedFeatures.find((candidate) => matchesConfig(candidate, config));

  if (!feature) {
    return null;
  }

  return {
    points: feature.geometry.points,
    sourceFeatureCount: 1,
    sourcePointCount: feature.geometry.points.length,
    sourceName: "curated-modern-qinling",
    verification: "needs-review"
  };
}

function aggregateOsmFeature(config, osmFeatures, curatedFeatures) {
  if (config.preferCuratedFallback) {
    const fallback = curatedFallback(config, curatedFeatures);

    if (fallback) {
      fallback.points = orientDownstream(fallback.points, config.downstreamDirection);
    }

    return fallback;
  }

  const matches = osmFeatures.filter((feature) => matchesConfig(feature, config));
  const sourcePoints = matches.flatMap((feature) => feature.geometry.points ?? []);

  if (sourcePoints.length >= 4) {
    const components = connectedComponents(matches);
    const component = selectBestComponent(config, components);
    const orderedPoints = orientDownstream(
      joinComponentWays(component),
      config.downstreamDirection
    );

    return {
      points: simplifyLineByDistance(orderedPoints),
      sourceFeatureCount: component.length,
      sourcePointCount: component.reduce(
        (total, feature) => total + (feature.geometry.points?.length ?? 0),
        0
      ),
      sourceName: "openstreetmap-overpass",
      verification: config.needsReview ? "needs-review" : "external-vector"
    };
  }

  const fallback = curatedFallback(config, curatedFeatures);

  if (fallback) {
    fallback.points = orientDownstream(fallback.points, config.downstreamDirection);
  }

  return fallback;
}

const osmAsset = JSON.parse(await readFile(osmInputPath, "utf8"));
const curatedAsset = JSON.parse(await readFile(curatedInputPath, "utf8"));
const features = PRIMARY_WATERWAYS.flatMap((config) => {
  const aggregate = aggregateOsmFeature(
    config,
    osmAsset.features ?? [],
    curatedAsset.features ?? []
  );

  if (!aggregate) {
    return [];
  }

  return [{
    id: config.id,
    name: config.displayName,
    displayName: config.displayName,
    aliases: config.aliases ?? [],
    kind: config.kind,
    rank: config.rank,
    basin: config.basin,
    eraId: "modern",
    terrainRole: config.rank === 1 ? "main-river" : "primary-tributary",
    source: {
      name: "primary-modern-qinling",
      confidence: aggregate.verification === "external-vector" ? "medium" : "low",
      verification: aggregate.verification,
      derivedFrom: aggregate.sourceName
    },
    sourceFeatureCount: aggregate.sourceFeatureCount,
    sourcePointCount: aggregate.sourcePointCount,
    relations: [],
    geometry: {
      points: aggregate.points
    }
  }];
});

const asset = {
  schema: "visual-china.region-hydrography.v2",
  regionId: "qinling",
  eraId: "modern",
  basePolicy: "modern-hydrography",
  displayScope: "main-rivers-and-primary-tributaries",
  source: {
    name: "primary-modern-qinling",
    confidence: "medium",
    inputs: [
      "public/data/regions/qinling/hydrography/osm-modern.json",
      "public/data/regions/qinling/hydrography/modern.json"
    ]
  },
  notes: [
    "Aggregated from OSM named waterway evidence plus curated fallback for Qinling.",
    "This v2 asset is limited to main rivers and primary tributaries; local ditches, canals, and minor unnamed streams stay out of default 3D rendering.",
    "Geometry is generalized for L1 touring readability and should be reviewed against authoritative hydrography before being treated as final."
  ],
  generatedAt: new Date().toISOString(),
  features
};

await writeFile(outputPath, `${JSON.stringify(asset, null, 2)}\n`, "utf8");
console.log(`Built primary Qinling hydrography asset with ${features.length} features at ${outputPath}`);
