export type QinlingAtlasLayerId =
  | "landform"
  | "water"
  | "city"
  | "pass"
  | "road"
  | "military"
  | "livelihood"
  | "culture"
  | "scenic"
  | "ancient";

export type QinlingScenicRole =
  | "alpine-peak"
  | "religious-mountain"
  | "karst-lake-system"
  | "buddhist-relic"
  | "imperial-mausoleum"
  | "travertine-terraces"
  | "karst-sinkhole";

export type QinlingAncientRole =
  | "shu-bronze-altar"
  | "shu-sun-bird"
  | "yangshao-dwelling"
  | "qin-terracotta-army"
  | "imperial-tomb"
  | "tusi-military-castle"
  | "ethnic-village"
  | "stone-inscription";

export interface QinlingScenicLandmark {
  id: string;
  name: string;
  lat: number;
  lon: number;
  summary: string;
  role: QinlingScenicRole;
}

export interface QinlingAncientSite {
  id: string;
  name: string;
  lat: number;
  lon: number;
  summary: string;
  role: QinlingAncientRole;
  symbol: QinlingAtlasVisualRule;
}

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
  source?: {
    name?: string;
    confidence?: string;
    verification?: "unverified" | "external-vector" | "verified";
    license?: string;
  };
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
export const qinlingScenicLandmarks: QinlingScenicLandmark[];
export const qinlingAncientSites: QinlingAncientSite[];
export const ancientImperialTombSymbol: QinlingAtlasVisualRule;

export function atlasFeaturesByLayer(
  layerId: QinlingAtlasLayerId
): QinlingAtlasFeature[];

export function highPriorityAtlasFeatures(
  maxPriority?: number
): QinlingAtlasFeature[];
