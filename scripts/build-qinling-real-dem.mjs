import fs from "node:fs/promises";
import path from "node:path";

import { fromFile } from "geotiff";

import {
  intersectBounds,
  parseFabdemTileName,
  qinlingBounds,
  qinlingOutputGrid,
  qinlingRegionManifestBounds,
  qinlingWorkspacePath,
  qinlingWorld
} from "./qinling-dem-common.mjs";

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

  if (count === 0) {
    return 0;
  }

  return total / count - center;
}

function smoothHeightField(values, columns, rows, { passes = 1, blend = 0.5 } = {}) {
  let current = values;

  for (let pass = 0; pass < passes; pass += 1) {
    const next = new Float32Array(current);

    for (let row = 1; row < rows - 1; row += 1) {
      for (let column = 1; column < columns - 1; column += 1) {
        let total = 0;
        let count = 0;

        for (let y = row - 1; y <= row + 1; y += 1) {
          for (let x = column - 1; x <= column + 1; x += 1) {
            total += current[indexAt(x, y, columns)];
            count += 1;
          }
        }

        const index = indexAt(column, row, columns);
        next[index] = current[index] * (1 - blend) + (total / count) * blend;
      }
    }

    current = next;
  }

  return current;
}

function normalizeHeights(rawHeights, minRawHeight, maxRawHeight) {
  const range = maxRawHeight - minRawHeight || 1;
  const normalized = new Float32Array(rawHeights.length);
  let minHeight = Number.POSITIVE_INFINITY;
  let maxHeight = Number.NEGATIVE_INFINITY;
  const visualMinHeight = -4;
  const visualMaxHeight = 18;

  for (let index = 0; index < rawHeights.length; index += 1) {
    const value = rawHeights[index];
    const t = clamp((value - minRawHeight) / range, 0, 1);
    const eased = Math.pow(t, 0.95);
    const stylized = visualMinHeight + eased * (visualMaxHeight - visualMinHeight);
    normalized[index] = stylized;
    minHeight = Math.min(minHeight, stylized);
    maxHeight = Math.max(maxHeight, stylized);
  }

  return { normalized, minHeight, maxHeight };
}

const tilesDir = qinlingWorkspacePath("data", "fabdem", "qinling", "tiles");
const legacyOutputPath = qinlingWorkspacePath("public", "data", "qinling-slice-dem.json");

async function findGeoTiffFiles(directory) {
  const result = [];
  const entries = await fs.readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      result.push(...(await findGeoTiffFiles(entryPath)));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith(".tif")) {
      result.push(entryPath);
    }
  }

  return result;
}

const tilePaths = (await findGeoTiffFiles(tilesDir))
  .sort();
const availableTileNames = new Set(tilePaths.map((tilePath) => path.basename(tilePath)));
const requiredTileNames = [];

for (
  let south = Math.floor(qinlingBounds.south);
  south < Math.ceil(qinlingBounds.north);
  south += 1
) {
  for (
    let west = Math.floor(qinlingBounds.west);
    west < Math.ceil(qinlingBounds.east);
    west += 1
  ) {
    const tileBounds = { south, north: south + 1, west, east: west + 1 };

    if (!intersectBounds(tileBounds, qinlingBounds)) {
      continue;
    }

    requiredTileNames.push(`N${String(south).padStart(2, "0")}E${String(west).padStart(3, "0")}_FABDEM_V1-2.tif`);
  }
}
const missingRequiredTileNames = requiredTileNames.filter(
  (tileName) => !availableTileNames.has(tileName)
);

if (tilePaths.length === 0) {
  throw new Error(`No Qinling GeoTIFF tiles found in ${tilesDir}. Run extract-qinling-fabdem first.`);
}

const columns = qinlingOutputGrid.columns;
const rows = qinlingOutputGrid.rows;
const rawHeights = new Float32Array(columns * rows);
rawHeights.fill(Number.NaN);

let sampledCellCount = 0;
let minRawHeight = Number.POSITIVE_INFINITY;
let maxRawHeight = Number.NEGATIVE_INFINITY;

for (const tilePath of tilePaths) {
  const tileName = path.basename(tilePath);
  const tileMeta = parseFabdemTileName(tileName);

  if (!tileMeta) {
    continue;
  }

  const overlap = intersectBounds(tileMeta, qinlingBounds);

  if (!overlap) {
    continue;
  }

  const tiff = await fromFile(tilePath);
  const image = await tiff.getImage();

  const columnStart = clamp(
    Math.floor(((overlap.west - qinlingBounds.west) / (qinlingBounds.east - qinlingBounds.west)) * columns),
    0,
    columns - 1
  );
  const columnEnd = clamp(
    Math.ceil(((overlap.east - qinlingBounds.west) / (qinlingBounds.east - qinlingBounds.west)) * columns),
    1,
    columns
  );
  const rowStart = clamp(
    Math.floor(((qinlingBounds.north - overlap.north) / (qinlingBounds.north - qinlingBounds.south)) * rows),
    0,
    rows - 1
  );
  const rowEnd = clamp(
    Math.ceil(((qinlingBounds.north - overlap.south) / (qinlingBounds.north - qinlingBounds.south)) * rows),
    1,
    rows
  );

  const window = [
    clamp(Math.floor((overlap.west - tileMeta.west) * image.getWidth()), 0, image.getWidth() - 1),
    clamp(Math.floor((tileMeta.north - overlap.north) * image.getHeight()), 0, image.getHeight() - 1),
    clamp(Math.ceil((overlap.east - tileMeta.west) * image.getWidth()), 1, image.getWidth()),
    clamp(Math.ceil((tileMeta.north - overlap.south) * image.getHeight()), 1, image.getHeight())
  ];

  const targetWidth = Math.max(1, columnEnd - columnStart);
  const targetHeight = Math.max(1, rowEnd - rowStart);

  const raster = await image.readRasters({
    interleave: true,
    window,
    width: targetWidth,
    height: targetHeight,
    resampleMethod: "bilinear",
    fillValue: -9999
  });

  for (let rowOffset = 0; rowOffset < targetHeight; rowOffset += 1) {
    for (let columnOffset = 0; columnOffset < targetWidth; columnOffset += 1) {
      const value = raster[rowOffset * targetWidth + columnOffset];

      if (!Number.isFinite(value) || value <= -9999) {
        continue;
      }

      const row = rowStart + rowOffset;
      const column = columnStart + columnOffset;
      const index = indexAt(column, row, columns);

      if (!Number.isFinite(rawHeights[index])) {
        sampledCellCount += 1;
      }

      rawHeights[index] = value;
      minRawHeight = Math.min(minRawHeight, value);
      maxRawHeight = Math.max(maxRawHeight, value);
    }
  }
}

if (!Number.isFinite(minRawHeight) || !Number.isFinite(maxRawHeight)) {
  throw new Error("No valid Qinling height samples were written.");
}

const coverageRatio = sampledCellCount / rawHeights.length;

if (coverageRatio < 0.1) {
  throw new Error(
    `Qinling DEM coverage is too sparse (${(coverageRatio * 100).toFixed(2)}%).`
  );
}

for (let pass = 0; pass < 4; pass += 1) {
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = indexAt(column, row, columns);

      if (Number.isFinite(rawHeights[index])) {
        continue;
      }

      let total = 0;
      let count = 0;

      for (let y = Math.max(0, row - 1); y <= Math.min(rows - 1, row + 1); y += 1) {
        for (let x = Math.max(0, column - 1); x <= Math.min(columns - 1, column + 1); x += 1) {
          const neighbor = rawHeights[indexAt(x, y, columns)];

          if (Number.isFinite(neighbor)) {
            total += neighbor;
            count += 1;
          }
        }
      }

      if (count > 0) {
        rawHeights[index] = total / count;
      }
    }
  }
}

for (let index = 0; index < rawHeights.length; index += 1) {
  if (!Number.isFinite(rawHeights[index])) {
    rawHeights[index] = minRawHeight;
  }
}

let { normalized, minHeight, maxHeight } = normalizeHeights(
  rawHeights,
  minRawHeight,
  maxRawHeight
);

const smoothed = smoothHeightField(normalized, columns, rows, {
  passes: 1,
  blend: 0.5
});
normalized = smoothed;
minHeight = Math.min(...normalized);
maxHeight = Math.max(...normalized);

const riverMask = [];
const passMask = [];
const settlementMask = [];

for (let row = 0; row < rows; row += 1) {
  for (let column = 0; column < columns; column += 1) {
    const index = indexAt(column, row, columns);
    const height = normalized[index];
    const normalizedHeight = (height - minHeight) / (maxHeight - minHeight || 1);
    const left = normalized[indexAt(Math.max(0, column - 1), row, columns)] ?? height;
    const right = normalized[indexAt(Math.min(columns - 1, column + 1), row, columns)] ?? height;
    const up = normalized[indexAt(column, Math.max(0, row - 1), columns)] ?? height;
    const down = normalized[indexAt(column, Math.min(rows - 1, row + 1), columns)] ?? height;
    const slope = Math.min(Math.hypot(right - left, down - up) / 12, 1);
    const valley = clamp(meanNeighborDifference(normalized, column, row, columns, rows) / 7.5, 0, 1);
    const moisture = smoothstep(1 - normalizedHeight, 0.15, 0.88);
    const passPotential = clamp((1 - slope) * (0.35 + normalizedHeight * 0.8) * (1 - valley * 0.6), 0, 1);

    riverMask.push(Number((valley * (1 - slope) * moisture).toFixed(4)));
    passMask.push(Number((Math.pow(passPotential, 1.8) * (1 - moisture * 0.25)).toFixed(4)));
    settlementMask.push(
      Number(
        clamp(0.86 - normalizedHeight * 0.44 - slope * 0.92 + moisture * 0.26, 0, 1).toFixed(4)
      )
    );
  }
}

const asset = {
  id: "qinling-l1-slice",
  type: "terrain-slice",
  version: 1,
  regionId: "qinling",
  lod: "L1",
  name: "qinling-real-dem-slice",
  sourceType: "processed-real-dem",
  generatedAt: new Date().toISOString(),
  bounds: qinlingRegionManifestBounds,
  world: qinlingWorld,
  grid: qinlingOutputGrid,
  minHeight: Number(minHeight.toFixed(3)),
  maxHeight: Number(maxHeight.toFixed(3)),
  presentation: {
    waterLevel: Number((minHeight - 2.5).toFixed(3)),
    underpaintLevel: Number((minHeight - 3.2).toFixed(3)),
    visualIntent: "Readable Guanzhong/Hanzhong/Sichuan basin lowlands with Qinling as a wall, not a sea-surrounded mountain island."
  },
  heights: Array.from(normalized, (value) => Number(value.toFixed(3))),
  riverMask,
  passMask,
  settlementMask,
  notes: [
    "Built from FABDEM tiles intersecting the Qinling region bounds.",
    "Real elevations are normalized into a gameplay-friendly stylized height range that keeps lowland basins readable.",
    `Raw sampled coverage before interpolation: ${(coverageRatio * 100).toFixed(2)}%.`,
    `Required FABDEM tiles: ${requiredTileNames.length}. Available required tiles: ${requiredTileNames.length - missingRequiredTileNames.length}.`,
    missingRequiredTileNames.length > 0
      ? `Missing required tiles filled by neighbor interpolation: ${missingRequiredTileNames.join(", ")}.`
      : "All required FABDEM tiles were available."
  ]
};

await fs.writeFile(legacyOutputPath, `${JSON.stringify(asset, null, 2)}\n`, "utf8");

console.log(`Generated real Qinling DEM asset at ${legacyOutputPath}`);
