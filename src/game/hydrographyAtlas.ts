import { projectGeoToWorld } from "./mapOrientation.js";
import { qinlingRegionBounds, qinlingRegionWorld } from "../data/qinlingRegion.js";
import type { QinlingAtlasFeature } from "./qinlingAtlas.js";
import type { HydrographyFeature } from "./hydrographyModel.js";

// 把 hydrography source 里的 {lat, lon} 点投到当前 region 的世界 (x, z=y)。
// 后向兼容：未迁移的 {x, y} 旧数据原样返回。
function projectPointsToWorld(points: Array<{ lat?: number; lon?: number; x?: number; y?: number }>) {
  return points.map((p) => {
    if (typeof p.lat === "number" && typeof p.lon === "number") {
      const wp = projectGeoToWorld({ lat: p.lat, lon: p.lon }, qinlingRegionBounds, qinlingRegionWorld);
      return { x: wp.x, y: wp.z };
    }
    return p;
  });
}

export function hydrographyFeatureToAtlasFeature(
  feature: HydrographyFeature
): QinlingAtlasFeature {
  const mainRiver = feature.rank <= 1;
  const primaryTributary = feature.rank === 2;
  const displayName = feature.displayName ?? feature.name;
  const stableWaterId = feature.id.replace(/^(river|stream)-/, "");

  // geometry.points 可能是 {lat, lon}（迁移后）或 {x, y}（迁移前 / OSM 数据）
  const projectedGeometry = feature.geometry?.points
    ? { ...feature.geometry, points: projectPointsToWorld(feature.geometry.points) }
    : feature.geometry;

  return {
    id: `water-${stableWaterId}`,
    name: displayName,
    layer: "water",
    geometry: feature.kind === "lake" || feature.kind === "wetland" ? "area" : "polyline",
    world: projectedGeometry,
    displayPriority: mainRiver ? 10 : primaryTributary ? 8 : 7,
    terrainRole: mainRiver ? "main-river" : primaryTributary ? "primary-tributary" : "tributary-river",
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
  } as QinlingAtlasFeature;
}
