import path from "node:path";

export const fabdemDataset = {
  name: "FABDEM V1-2",
  datasetId: "s5hqmjcdj8yo2ibzi9b4ew3sn",
  baseUrl: "https://data.bris.ac.uk/datasets/s5hqmjcdj8yo2ibzi9b4ew3sn",
  suffix: "FABDEM_V1-2.zip",
  license: "CC BY-NC-SA 4.0"
};

export const chinaBounds = {
  west: 73,
  east: 135,
  south: 18,
  north: 54
};

export const chinaNationalOutput = {
  columns: 576,
  rows: 336
};

export function workspacePath(...parts) {
  return path.join(process.cwd(), ...parts);
}

function padCoordinate(value, digits = 2) {
  return String(Math.abs(value)).padStart(digits, "0");
}

function latToken(latitude) {
  return `${latitude >= 0 ? "N" : "S"}${padCoordinate(latitude)}`;
}

function lonToken(longitude) {
  return `${longitude >= 0 ? "E" : "W"}${padCoordinate(longitude, 3)}`;
}

export function fabdemGroupName(latMin, lonMin) {
  const latMax = latMin + 10;
  const lonMax = lonMin + 10;
  return `${latToken(latMin)}${lonToken(lonMin)}-${latToken(latMax)}${lonToken(lonMax)}_${fabdemDataset.suffix}`;
}

function pushGroups(list, latMin, lonStarts) {
  lonStarts.forEach((lonMin) => {
    const archiveName = fabdemGroupName(latMin, lonMin);
    list.push({
      latMin,
      latMax: latMin + 10,
      lonMin,
      lonMax: lonMin + 10,
      archiveName,
      url: `${fabdemDataset.baseUrl}/${archiveName}`
    });
  });
}

export function chinaFabdemGroups() {
  const groups = [];

  pushGroups(groups, 10, [100, 110, 120]);

  [20, 30, 40, 50].forEach((latMin) => {
    pushGroups(groups, latMin, [70, 80, 90, 100, 110, 120, 130]);
  });

  return groups;
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
