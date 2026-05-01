export function hydrographyFeatureToAtlasFeature(feature) {
  const mainRiver = feature.rank <= 1;
  const displayName = feature.displayName ?? feature.name;
  const stableWaterId = feature.id.replace(/^(river|stream)-/, "");

  return {
    id: `water-${stableWaterId}`,
    name: displayName,
    layer: "water",
    geometry: feature.kind === "lake" || feature.kind === "wetland" ? "area" : "polyline",
    world: feature.geometry,
    displayPriority: mainRiver ? 10 : 7,
    terrainRole: mainRiver ? "main-river" : "tributary-river",
    themes: ["terrain", "livelihood"],
    source: {
      ...(feature.source ?? {}),
      verification: feature.source?.verification ?? "unverified"
    },
    copy: {
      summary: `${feature.name}是${feature.basin}的${mainRiver ? "主干水系" : "支流水系"}，用于解释地貌、聚落和道路关系。`
    },
    visualRule: {
      symbol: mainRiver ? "main-river-line" : "tributary-line",
      color: "#5eb8c9",
      emphasis: mainRiver ? "main-river" : "tributary"
    }
  };
}
