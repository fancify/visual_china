import path from "node:path";

import { fabdemDataset } from "./china-dem-common.mjs";

// 2026-05 Phase 2：bounds 扩到全中国。跟 src/data/qinlingRegion.js 必须同值
// （构建期 + 运行期一致）。
export const qinlingBounds = {
  west: 73.0,
  east: 135.0,
  south: 18.0,
  north: 53.0
};

export const qinlingRegionManifestBounds = { ...qinlingBounds };

export const qinlingWorld = {
  // 保持 u/°lon = 27.6，不拉长东西向比例。
  width: 1711,
  // 用 cos(midLat=35.5°) 校正物理纵横比；必须跟运行期 source of truth 一致。
  depth: 1186
};

export const qinlingGeographicFootprintKm = {
  width: 5602.74,
  depth: 3885
};

export const qinlingOutputGrid = {
  columns: 3113,
  rows: 2158
};

export const qinlingResolutionStrategy = {
  experienceLayer: "L1-national-tour-local-pilot",
  coordinatePolicy: "strict-geographic",
  target: "1800m-stride4-450m",
  comment: "Full China at 1.8 km cell with ETOPO 60s + future HydroSHEDS upgrade path",
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
      bounds: { west: 106.4, east: 110.5, south: 33.75, north: 34.95 },
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
      bounds: { west: 103.5, east: 107.6, south: 28.5, north: 32.35 },
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
