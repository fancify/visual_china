import fs from "node:fs/promises";
import path from "node:path";

import {
  chinaBounds,
  chinaLowresOutput,
  chinaLowresOutputPath,
  chinaLowresSourcePath,
  etopoLowresSource
} from "./china-lowres-dem-common.mjs";

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothstep(value, min, max) {
  if (min === max) {
    return value < min ? 0 : 1;
  }

  const t = clamp((value - min) / (max - min), 0, 1);
  return t * t * (3 - 2 * t);
}

function indexAt(column, row, columns) {
  return row * columns + column;
}

function meanNeighborDifference(values, column, row, columns, rows) {
  const center = values[indexAt(column, row, columns)];

  if (!Number.isFinite(center)) {
    return 0;
  }

  let total = 0;
  let count = 0;

  for (let y = Math.max(0, row - 1); y <= Math.min(rows - 1, row + 1); y += 1) {
    for (let x = Math.max(0, column - 1); x <= Math.min(columns - 1, column + 1); x += 1) {
      if (x === column && y === row) {
        continue;
      }

      const neighbor = values[indexAt(x, y, columns)];

      if (Number.isFinite(neighbor)) {
        total += neighbor;
        count += 1;
      }
    }
  }

  return count > 0 ? total / count - center : 0;
}

function parseNumberList(line) {
  return line
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
}

function parseOpendapAscii(raw) {
  const lines = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const latHeaderIndex = lines.findIndex((line) => line.startsWith("lat["));
  const lonHeaderIndex = lines.findIndex((line) => line.startsWith("lon["));

  if (latHeaderIndex < 0 || lonHeaderIndex < 0) {
    throw new Error("Could not find lat/lon arrays in ETOPO OPeNDAP subset.");
  }

  const lat = parseNumberList(lines[latHeaderIndex + 1]);
  const lon = parseNumberList(lines[lonHeaderIndex + 1]);
  const rowLines = lines.filter((line) => /^\[\d+\],/.test(line));
  const values = [];

  rowLines.forEach((line) => {
    values.push(parseNumberList(line.replace(/^\[\d+\],/, "")));
  });

  if (values.length !== lat.length) {
    throw new Error(`Expected ${lat.length} ETOPO rows, found ${values.length}.`);
  }

  values.forEach((row, index) => {
    if (row.length !== lon.length) {
      throw new Error(`Expected ${lon.length} values in ETOPO row ${index}, found ${row.length}.`);
    }
  });

  return { lat, lon, values };
}

try {
  await fs.access(chinaLowresSourcePath);
} catch {
  throw new Error(
    `Missing ${chinaLowresSourcePath}. Run npm run china:lowres:download first.`
  );
}

const source = parseOpendapAscii(await fs.readFile(chinaLowresSourcePath, "utf8"));
const columns = chinaLowresOutput.columns;
const rows = chinaLowresOutput.rows;
const heights = new Float32Array(columns * rows);
let minHeight = Number.POSITIVE_INFINITY;
let maxHeight = Number.NEGATIVE_INFINITY;
let minSourceHeight = Number.POSITIVE_INFINITY;
let maxSourceHeight = Number.NEGATIVE_INFINITY;

if (source.lon.length !== columns || source.lat.length !== rows) {
  throw new Error(
    `Unexpected ETOPO subset grid ${source.lon.length}x${source.lat.length}; expected ${columns}x${rows}.`
  );
}

for (let row = 0; row < rows; row += 1) {
  for (let column = 0; column < columns; column += 1) {
    const sourceRow = rows - 1 - row;
    const sourceValue = source.values[sourceRow][column];
    const value = Math.max(0, sourceValue);
    const index = indexAt(column, row, columns);
    heights[index] = value;
    minSourceHeight = Math.min(minSourceHeight, sourceValue);
    maxSourceHeight = Math.max(maxSourceHeight, sourceValue);
    minHeight = Math.min(minHeight, value);
    maxHeight = Math.max(maxHeight, value);
  }
}

if (!Number.isFinite(minHeight) || !Number.isFinite(maxHeight)) {
  throw new Error("No valid height samples were written into the low-resolution China DEM asset.");
}

const riverMask = [];
const passMask = [];
const settlementMask = [];

for (let row = 0; row < rows; row += 1) {
  for (let column = 0; column < columns; column += 1) {
    const index = indexAt(column, row, columns);
    const height = heights[index];
    const normalizedHeight =
      (height - minHeight) / (maxHeight - minHeight || 1);
    const left = heights[indexAt(Math.max(0, column - 1), row, columns)] ?? height;
    const right = heights[indexAt(Math.min(columns - 1, column + 1), row, columns)] ?? height;
    const up = heights[indexAt(column, Math.max(0, row - 1), columns)] ?? height;
    const down = heights[indexAt(column, Math.min(rows - 1, row + 1), columns)] ?? height;
    const slope = Math.min(Math.hypot(right - left, down - up) / 1900, 1);
    const valley = clamp(meanNeighborDifference(heights, column, row, columns, rows) / 220, 0, 1);
    const lowlandMoisture = smoothstep(1 - normalizedHeight, 0.16, 0.88);

    riverMask.push(Number((valley * (1 - slope) * lowlandMoisture).toFixed(4)));
    passMask.push(0);
    settlementMask.push(
      Number(
        clamp(0.86 - normalizedHeight * 0.48 - slope * 0.72 + lowlandMoisture * 0.12, 0, 1).toFixed(4)
      )
    );
  }
}

const asset = {
  name: "china-lowres-etopo-2022-60s",
  sourceType: etopoLowresSource.name,
  generatedAt: new Date().toISOString(),
  bounds: chinaBounds,
  world: {
    width: 320,
    depth: Number(
      (320 / ((chinaBounds.east - chinaBounds.west) / (chinaBounds.north - chinaBounds.south))).toFixed(3)
    )
  },
  grid: { columns, rows },
  minHeight: Number(minHeight.toFixed(3)),
  maxHeight: Number(maxHeight.toFixed(3)),
  heights: Array.from(heights, (value) => Number(value.toFixed(3))),
  riverMask,
  passMask,
  settlementMask,
  source: {
    name: etopoLowresSource.name,
    acquisition: "NOAA THREDDS OPeNDAP subset",
    subsetStride: etopoLowresSource.subsetStride,
    sourceGrid: { columns: source.lon.length, rows: source.lat.length },
    sourceHeightRange: {
      min: Number(minSourceHeight.toFixed(3)),
      max: Number(maxSourceHeight.toFixed(3))
    },
    citation: etopoLowresSource.citation
  },
  notes: [
    "Built as a low-resolution national overview from NOAA ETOPO 2022 60 arc-second bedrock elevation.",
    "Bathymetry is clamped to sea level for terrain-height purposes so ocean depth does not flatten land relief.",
    "This asset is intended for China-scale overview, routing context, and LOD planning, not detailed regional terrain.",
    "Use focused high-resolution regional sources such as FABDEM for priority gameplay slices.",
    etopoLowresSource.citation
  ]
};

await fs.mkdir(path.dirname(chinaLowresOutputPath), { recursive: true });
await fs.writeFile(chinaLowresOutputPath, `${JSON.stringify(asset, null, 2)}\n`, "utf8");

console.log(
  [
    `Generated ${chinaLowresOutputPath}`,
    `source=${etopoLowresSource.name}`,
    `grid=${columns}x${rows}`,
    `heights=${asset.minHeight}..${asset.maxHeight}`
  ].join(" | ")
);
