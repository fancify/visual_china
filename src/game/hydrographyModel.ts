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
    verification?: string;
    license?: string;
  };
  relations: string[];
  geometry: {
    points: HydrographyPoint[];
  };
}

const LOD_MAX_RANK: Record<HydrographyLod, number> = {
  l0: 1,
  l1: 3,
  l2: 6
};

export function normalizeHydrographyFeature(
  raw: Omit<HydrographyFeature, "aliases" | "relations"> &
    Partial<Pick<HydrographyFeature, "aliases" | "relations">>
): HydrographyFeature {
  return {
    aliases: [],
    relations: [],
    ...raw,
    eraId: raw.eraId ?? "modern",
    source: {
      name: raw.source.name,
      confidence: raw.source.confidence
    }
  };
}

export function hydrographyFeatureKey(feature: HydrographyFeature): string {
  return `${feature.eraId}:${feature.id}`;
}

export function hydrographyVisibleAtLod(
  feature: HydrographyFeature,
  lod: HydrographyLod
): boolean {
  return feature.rank <= LOD_MAX_RANK[lod];
}
