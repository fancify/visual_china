import path from "node:path";

import { fabdemDataset } from "./china-dem-common.mjs";

export const qinlingBounds = {
  west: 103.5,
  east: 109.0,
  south: 30.4,
  north: 35.4
};

export const qinlingRegionManifestBounds = { ...qinlingBounds };

export const qinlingWorld = {
  width: 180,
  depth: 240
};

export const qinlingOutputGrid = {
  columns: 193,
  rows: 241
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
