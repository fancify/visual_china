export type QinlingAtlasLayerId =
  | "landform"
  | "water"
  | "city"
  | "pass"
  | "road"
  | "military"
  | "livelihood"
  | "culture";

export interface QinlingAtlasPoint {
  x: number;
  y: number;
}

export type QinlingAtlasGeometry = "point" | "polyline" | "area";

export interface QinlingAtlasLayer {
  id: QinlingAtlasLayerId;
  name: string;
  defaultVisible: boolean;
  description: string;
}

export interface QinlingAtlasVisualRule {
  symbol: string;
  color: string;
  emphasis: string;
}

export interface QinlingAtlasFeature {
  id: string;
  name: string;
  layer: QinlingAtlasLayerId;
  geometry: QinlingAtlasGeometry;
  world: QinlingAtlasPoint | { points: QinlingAtlasPoint[] };
  displayPriority: number;
  terrainRole: string;
  themes: string[];
  copy: {
    summary: string;
  };
  visualRule: QinlingAtlasVisualRule;
}

export const qinlingAtlasPolicy: {
  sourceOfTruth: "2d-atlas-first";
  coordinatePolicy: "strict-geographic";
  projection: "same-world-coordinates-as-3d";
  gameplayCompression: string;
};

export const qinlingAtlasLayers: QinlingAtlasLayer[];
export const qinlingAtlasRequiredNames: string[];
export const qinlingAtlasFeatures: QinlingAtlasFeature[];
export const qinlingWaterSystem: QinlingAtlasFeature[];

export function atlasFeaturesByLayer(
  layerId: QinlingAtlasLayerId
): QinlingAtlasFeature[];

export function highPriorityAtlasFeatures(
  maxPriority?: number
): QinlingAtlasFeature[];
