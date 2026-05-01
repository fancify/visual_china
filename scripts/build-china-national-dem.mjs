import fs from "node:fs/promises";
import path from "node:path";

import { fromFile } from "geotiff";

import {
  chinaBounds,
  chinaNationalOutput,
  intersectBounds,
  parseFabdemTileName,
  workspacePath
} from "./china-dem-common.mjs";

const tilesDir = workspacePath("data", "fabdem", "china", "tiles");
const outputPath = workspacePath("public", "data", "china-national-dem.json");
const args = new Set(process.argv.slice(2));
const allowPartial = args.has("--allow-partial");

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

const tileNames = (await fs.readdir(tilesDir))
  .filter((name) => name.endsWith(".tif"))
  .sort();

if (tileNames.length === 0) {
  throw new Error(`No GeoTIFF tiles found in ${tilesDir}. Run extract-china-fabdem first.`);
}

const columns = chinaNationalOutput.columns;
const rows = chinaNationalOutput.rows;
const heights = new Float32Array(columns * rows);
heights.fill(Number.NaN);

let minHeight = Number.POSITIVE_INFINITY;
let maxHeight = Number.NEGATIVE_INFINITY;
let sampledCellCount = 0;

for (const tileName of tileNames) {
  const tileMeta = parseFabdemTileName(tileName);

  if (!tileMeta) {
    continue;
  }

  const overlap = intersectBounds(tileMeta, chinaBounds);

  if (!overlap) {
    continue;
  }

  const tilePath = path.join(tilesDir, tileName);
  const tiff = await fromFile(tilePath);
  const image = await tiff.getImage();

  const columnStart = clamp(
    Math.floor(((overlap.west - chinaBounds.west) / (chinaBounds.east - chinaBounds.west)) * columns),
    0,
    columns - 1
  );
  const columnEnd = clamp(
    Math.ceil(((overlap.east - chinaBounds.west) / (chinaBounds.east - chinaBounds.west)) * columns),
    1,
    columns
  );
  const rowStart = clamp(
    Math.floor(((chinaBounds.north - overlap.north) / (chinaBounds.north - chinaBounds.south)) * rows),
    0,
    rows - 1
  );
  const rowEnd = clamp(
    Math.ceil(((chinaBounds.north - overlap.south) / (chinaBounds.north - chinaBounds.south)) * rows),
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
      if (!Number.isFinite(heights[index])) {
        sampledCellCount += 1;
      }
      heights[index] = value;
      minHeight = Math.min(minHeight, value);
      maxHeight = Math.max(maxHeight, value);
    }
  }
}

for (let pass = 0; pass < 3; pass += 1) {
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const index = indexAt(column, row, columns);

      if (Number.isFinite(heights[index])) {
        continue;
      }

      let total = 0;
      let count = 0;

      for (let y = Math.max(0, row - 1); y <= Math.min(rows - 1, row + 1); y += 1) {
        for (let x = Math.max(0, column - 1); x <= Math.min(columns - 1, column + 1); x += 1) {
          const neighbor = heights[indexAt(x, y, columns)];

          if (Number.isFinite(neighbor)) {
            total += neighbor;
            count += 1;
          }
        }
      }

      if (count > 0) {
        heights[index] = total / count;
      }
    }
  }
}

if (!Number.isFinite(minHeight) || !Number.isFinite(maxHeight)) {
  throw new Error("No valid height samples were written into the national DEM asset.");
}

const heightRange = maxHeight - minHeight;
const coverageRatio = sampledCellCount / heights.length;

if (!allowPartial && coverageRatio < 0.02) {
  throw new Error(
    `National DEM coverage is too sparse (${(coverageRatio * 100).toFixed(2)}%). Pass --allow-partial only for exploratory builds.`
  );
}

if (!allowPartial && heightRange < 1) {
  throw new Error(
    `National DEM height range is too small (${heightRange.toFixed(3)}). This usually indicates an invalid or ocean-only export.`
  );
}

for (let index = 0; index < heights.length; index += 1) {
  if (!Number.isFinite(heights[index])) {
    heights[index] = minHeight;
  }
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
    const slope = Math.min(Math.hypot(right - left, down - up) / 1600, 1);
    const valley = clamp(meanNeighborDifference(heights, column, row, columns, rows) / 180, 0, 1);
    const moisture = smoothstep(1 - normalizedHeight, 0.12, 0.85);

    riverMask.push(Number((valley * (1 - slope) * moisture).toFixed(4)));
    passMask.push(0);
    settlementMask.push(
      Number(
        clamp(0.82 - normalizedHeight * 0.44 - slope * 0.88 + moisture * 0.18, 0, 1).toFixed(4)
      )
    );
  }
}

const asset = {
  name: "china-national-fabdem-v1-2",
  sourceType: "FABDEM V1-2",
  generatedAt: new Date().toISOString(),
  bounds: chinaBounds,
  world: {
    width: 320,
    depth: Number((320 / ((chinaBounds.east - chinaBounds.west) / (chinaBounds.north - chinaBounds.south))).toFixed(3))
  },
  grid: { columns, rows },
  minHeight: Number(minHeight.toFixed(3)),
  maxHeight: Number(maxHeight.toFixed(3)),
  heights: Array.from(heights, (value) => Number(value.toFixed(3))),
  riverMask,
  passMask,
  settlementMask,
  notes: [
    "Built from extracted FABDEM GeoTIFF tiles intersecting China's bounding box.",
    "Pass mask is placeholder zeroed in this first nationwide pipeline.",
    "FABDEM license is CC BY-NC-SA 4.0; use with care for commercial work."
  ]
};

await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, `${JSON.stringify(asset, null, 2)}\n`, "utf8");

console.log(`Generated ${outputPath}`);
