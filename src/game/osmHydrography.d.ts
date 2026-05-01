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

export function lonLatToWorldPoint(
  coordinate: { lon: number; lat: number },
  bounds: DemBounds,
  world: DemWorld
): HydrographyPoint;

export function normalizeOsmWaterways(
  overpassJson: OverpassJson,
  options: {
    bounds: DemBounds;
    world: DemWorld;
    regionId: string;
  }
): {
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
};
