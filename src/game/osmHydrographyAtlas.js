import { hydrographyFeatureToAtlasFeature } from "./hydrographyAtlas.js";

const BACKBONE_WATER_NAMES = [
  "渭河",
  "汉江",
  "汉水",
  "嘉陵江",
  "泾河",
  "洛河",
  "褒河",
  "褒水",
  "沣河",
  "黑河",
  "涝河",
  "湑水河",
  "沮河"
];

function waterNameMatches(feature, names) {
  const labels = [feature.name, feature.displayName, ...(feature.aliases ?? [])].filter(Boolean);

  return names.some((name) => labels.some((label) => label.includes(name)));
}

export function importedWaterDisplayPriority(feature) {
  if (waterNameMatches(feature, BACKBONE_WATER_NAMES)) {
    return 8;
  }

  if (feature.kind === "river") {
    return 5;
  }

  return 0;
}

export function importedHydrographyFeatureToAtlasFeature(feature) {
  const displayPriority = importedWaterDisplayPriority(feature);
  const atlasFeature = hydrographyFeatureToAtlasFeature({
    ...feature,
    rank: displayPriority >= 8 ? 1 : 3
  });

  return {
    ...atlasFeature,
    id: `osm-${atlasFeature.id}`,
    displayPriority,
    terrainRole:
      feature.kind === "canal"
        ? "canal-waterwork"
        : displayPriority >= 8
          ? "main-river-evidence"
          : "named-tributary-evidence",
    themes: [...new Set([...atlasFeature.themes, "evidence"])],
    source: {
      ...(atlasFeature.source ?? {}),
      name: feature.source?.name ?? "openstreetmap-overpass",
      confidence: feature.source?.confidence ?? "medium",
      verification: "external-vector",
      license: "ODbL-1.0"
    },
    copy: {
      summary: `${feature.name}来自 OSM 现代水系导入层，用于校准真实河网、支流关系和地图细部。`
    },
    visualRule: {
      ...atlasFeature.visualRule,
      color: feature.kind === "canal" ? "#6fbfae" : "#4fb6d1",
      emphasis:
        displayPriority >= 8
          ? "imported-main-river"
          : feature.kind === "canal"
            ? "imported-canal"
            : "imported-tributary"
    }
  };
}

export function importedHydrographyAssetToAtlasFeatures(asset) {
  const features = Array.isArray(asset?.features) ? asset.features : [];

  return features
    .map(importedHydrographyFeatureToAtlasFeature)
    .filter((feature) => feature.displayPriority > 0)
    .toSorted((a, b) => b.displayPriority - a.displayPriority);
}
