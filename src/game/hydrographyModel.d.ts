export type HydrographyKind =
  | "river"
  | "stream"
  | "canal"
  | "lake"
  | "wetland"
  | "reservoir"
  | "confluence";

export type HydrographyConfidence = "high" | "medium" | "low";
export type HydrographyLod = "l0" | "l1" | "l2";

export interface HydrographyPoint {
  x: number;
  y: number;
}

export interface HydrographyFeature {
  id: string;
  name: string;
  displayName?: string;
  aliases: string[];
  kind: HydrographyKind;
  rank: number;
  basin: string;
  eraId: string;
  source: {
    name: string;
    confidence: HydrographyConfidence;
  };
  relations: string[];
  geometry: {
    points: HydrographyPoint[];
  };
}

export function normalizeHydrographyFeature(
  raw: Omit<HydrographyFeature, "aliases" | "relations"> &
    Partial<Pick<HydrographyFeature, "aliases" | "relations">>
): HydrographyFeature;

export function hydrographyFeatureKey(feature: HydrographyFeature): string;

export function hydrographyVisibleAtLod(
  feature: HydrographyFeature,
  lod: HydrographyLod
): boolean;
