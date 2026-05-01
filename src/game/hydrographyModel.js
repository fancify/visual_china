const LOD_MAX_RANK = {
  l0: 1,
  l1: 3,
  l2: 6
};

export function normalizeHydrographyFeature(raw) {
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

export function hydrographyFeatureKey(feature) {
  return `${feature.eraId}:${feature.id}`;
}

export function hydrographyVisibleAtLod(feature, lod) {
  return feature.rank <= LOD_MAX_RANK[lod];
}
