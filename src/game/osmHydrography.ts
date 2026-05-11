import type { DemBounds, DemWorld } from "./demSampler.js";
import type { HydrographyFeature, HydrographyPoint } from "./hydrographyModel.js";

export interface OverpassNode {
  type: "node";
  id: number;
  lon: number;
  lat: number;
}

export interface OverpassWay {
  type: "way";
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}

export interface OverpassJson {
  elements?: Array<OverpassNode | OverpassWay | Record<string, unknown>>;
}

export interface NormalizedOsmHydrography {
  schema: "visual-china.region-hydrography.v1";
  regionId: string;
  eraId: "modern";
  basePolicy: "modern-hydrography";
  source: {
    name: "openstreetmap-overpass";
    license: "ODbL-1.0";
  };
  bounds: DemBounds;
  notes: string[];
  features: HydrographyFeature[];
}

const SUPPORTED_WATERWAYS = new Set(["river", "stream", "canal"]);

function roundPoint(point: { x: number; y: number }): HydrographyPoint {
  return {
    x: Number(point.x.toFixed(3)),
    y: Number(point.y.toFixed(3))
  };
}

function inBounds(node: { lon: number; lat: number }, bounds: DemBounds): boolean {
  return (
    node.lon >= bounds.west &&
    node.lon <= bounds.east &&
    node.lat >= bounds.south &&
    node.lat <= bounds.north
  );
}

function waterwayKind(waterway: string): "river" | "stream" | "canal" {
  if (waterway === "canal") {
    return "canal";
  }

  return waterway === "river" ? "river" : "stream";
}

function waterwayRank(waterway: string): number {
  return waterway === "river" ? 1 : 3;
}

export function lonLatToWorldPoint(
  { lon, lat }: { lon: number; lat: number },
  bounds: DemBounds,
  world: DemWorld
): HydrographyPoint {
  return roundPoint({
    x: ((lon - bounds.west) / (bounds.east - bounds.west) - 0.5) * world.width,
    y: ((lat - bounds.south) / (bounds.north - bounds.south) - 0.5) * world.depth
  });
}

export function normalizeOsmWaterways(
  overpassJson: OverpassJson,
  { bounds, world, regionId }: { bounds: DemBounds; world: DemWorld; regionId: string }
): NormalizedOsmHydrography {
  const nodes = new Map<number, OverpassNode>();
  const elements = Array.isArray(overpassJson.elements) ? overpassJson.elements : [];

  elements.forEach((element: any) => {
    if (element.type === "node" && Number.isFinite(element.lon) && Number.isFinite(element.lat)) {
      nodes.set(element.id, element);
    }
  });

  const features = elements
    .filter((element: any) =>
      element.type === "way" &&
      Array.isArray(element.nodes) &&
      SUPPORTED_WATERWAYS.has(element.tags?.waterway)
    )
    .map((way: any): HydrographyFeature | null => {
      const waterway = way.tags.waterway;
      const points = way.nodes
        .map((nodeId: number) => nodes.get(nodeId))
        .filter((node: OverpassNode | undefined): node is OverpassNode =>
          Boolean(node) && inBounds(node!, bounds))
        .map((node: OverpassNode) => lonLatToWorldPoint({ lon: node.lon, lat: node.lat }, bounds, world));

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
    .filter((feature): feature is HydrographyFeature => feature !== null);

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
