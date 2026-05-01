const SUPPORTED_WATERWAYS = new Set(["river", "stream", "canal"]);

function roundPoint(point) {
  return {
    x: Number(point.x.toFixed(3)),
    y: Number(point.y.toFixed(3))
  };
}

function inBounds(node, bounds) {
  return (
    node.lon >= bounds.west &&
    node.lon <= bounds.east &&
    node.lat >= bounds.south &&
    node.lat <= bounds.north
  );
}

function waterwayKind(waterway) {
  if (waterway === "canal") {
    return "canal";
  }

  return waterway === "river" ? "river" : "stream";
}

function waterwayRank(waterway) {
  return waterway === "river" ? 1 : 3;
}

export function lonLatToWorldPoint({ lon, lat }, bounds, world) {
  return roundPoint({
    x: ((lon - bounds.west) / (bounds.east - bounds.west) - 0.5) * world.width,
    y: ((lat - bounds.south) / (bounds.north - bounds.south) - 0.5) * world.depth
  });
}

export function normalizeOsmWaterways(overpassJson, { bounds, world, regionId }) {
  const nodes = new Map();
  const elements = Array.isArray(overpassJson.elements) ? overpassJson.elements : [];

  elements.forEach((element) => {
    if (element.type === "node" && Number.isFinite(element.lon) && Number.isFinite(element.lat)) {
      nodes.set(element.id, element);
    }
  });

  const features = elements
    .filter((element) =>
      element.type === "way" &&
      Array.isArray(element.nodes) &&
      SUPPORTED_WATERWAYS.has(element.tags?.waterway)
    )
    .map((way) => {
      const waterway = way.tags.waterway;
      const points = way.nodes
        .map((nodeId) => nodes.get(nodeId))
        .filter((node) => node && inBounds(node, bounds))
        .map((node) => lonLatToWorldPoint({ lon: node.lon, lat: node.lat }, bounds, world));

      if (points.length < 2) {
        return null;
      }

      const name = way.tags.name ?? way.tags["name:zh"] ?? `OSM waterway ${way.id}`;

      return {
        id: `osm-way-${way.id}`,
        name,
        aliases: way.tags["name:zh"] && way.tags["name:zh"] !== name ? [way.tags["name:zh"]] : [],
        kind: waterwayKind(waterway),
        rank: waterwayRank(waterway),
        basin: "待核验流域",
        eraId: "modern",
        source: {
          name: "openstreetmap-overpass",
          confidence: way.tags.name || way.tags["name:zh"] ? "medium" : "low"
        },
        relations: [],
        geometry: { points }
      };
    })
    .filter(Boolean);

  return {
    schema: "visual-china.region-hydrography.v1",
    regionId,
    eraId: "modern",
    basePolicy: "modern-hydrography",
    source: {
      name: "openstreetmap-overpass",
      license: "ODbL-1.0"
    },
    bounds,
    notes: [
      "Normalized from OpenStreetMap waterways via Overpass.",
      "This is an imported evidence layer; curated names, ranks, basins, and narrative relations should be reviewed before replacing curated hydrography."
    ],
    features
  };
}
