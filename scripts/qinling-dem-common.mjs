import path from "node:path";

import { fabdemDataset } from "./china-dem-common.mjs";

// 2026-05 east extension 已完成（refactor #63 把所有 hardcoded {x,y} 迁到
// lat/lon 后，bounds 改成 1 行配置）：109 → 110，纳入 兵马俑 / 秦始皇陵 /
// 半坡。跟 src/data/qinlingRegion.js 必须同值（构建期 + 运行期一致）。
export const qinlingBounds = {
  west: 103.5,
  east: 110.0,
  south: 30.4,
  north: 35.4
};

export const qinlingRegionManifestBounds = { ...qinlingBounds };

export const qinlingWorld = {
  width: 180,
  depth: 240
};

export const qinlingGeographicFootprintKm = {
  width: 420,
  depth: 560
};

export const qinlingOutputGrid = {
  columns: 193,
  rows: 241
};

export const qinlingResolutionStrategy = {
  experienceLayer: "L1-national-tour-local-pilot",
  coordinatePolicy: "strict-geographic",
  baseTerrainResolutionMeters: 90,
  detailCorrectionResolutionMeters: 30,
  sparseRegionResolutionMeters: 450,
  runtimeSampleSpacingKm: {
    eastWest: Number(
      (qinlingGeographicFootprintKm.width / (qinlingOutputGrid.columns - 1)).toFixed(2)
    ),
    northSouth: Number(
      (qinlingGeographicFootprintKm.depth / (qinlingOutputGrid.rows - 1)).toFixed(2)
    )
  },
  detailCorrectionZones: [
    {
      id: "guanzhong-plain",
      role: "basin-edge-readability",
      bounds: { west: 106.4, east: 109.0, south: 33.75, north: 34.95 },
      correctionWeight: 0.7
    },
    {
      id: "hanzhong-basin",
      role: "basin-floor-readability",
      bounds: { west: 106.05, east: 108.0, south: 32.55, north: 33.55 },
      correctionWeight: 0.8
    },
    {
      id: "northern-sichuan-basin",
      role: "basin-transition-readability",
      bounds: { west: 103.5, east: 106.25, south: 30.4, north: 32.35 },
      correctionWeight: 0.65
    },
    {
      id: "qinling-shu-road-corridors",
      role: "route-corridor-terrain",
      bounds: { west: 104.7, east: 108.65, south: 31.45, north: 34.65 },
      correctionWeight: 0.75
    }
  ]
};

export const qinlingFabdemArchive = {
  archiveName: "N30E100-N40E110_FABDEM_V1-2.zip",
  url: `${fabdemDataset.baseUrl}/N30E100-N40E110_FABDEM_V1-2.zip`,
  expectedBytes: 2692425722
};

export function qinlingWorkspacePath(...parts) {
  return path.join(process.cwd(), ...parts);
}

export function intersectBounds(a, b) {
  const west = Math.max(a.west, b.west);
  const east = Math.min(a.east, b.east);
  const south = Math.max(a.south, b.south);
  const north = Math.min(a.north, b.north);

  if (west >= east || south >= north) {
    return null;
  }

  return { west, east, south, north };
}

export function parseFabdemTileName(fileName) {
  const match = fileName.match(/([NS])(\d{2})([EW])(\d{3})_FABDEM_V1-2\.tif$/);

  if (!match) {
    return null;
  }

  const [, latHemisphere, latRaw, lonHemisphere, lonRaw] = match;
  const south = Number(latRaw) * (latHemisphere === "S" ? -1 : 1);
  const west = Number(lonRaw) * (lonHemisphere === "W" ? -1 : 1);

  return {
    name: fileName,
    south,
    north: south + 1,
    west,
    east: west + 1
  };
}
