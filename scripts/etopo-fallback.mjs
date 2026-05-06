import fs from "node:fs/promises";

import { fromFile } from "geotiff";

import { qinlingWorkspacePath } from "./qinling-dem-common.mjs";

const ETOPO_TIFF_PATH = qinlingWorkspacePath(
  "data",
  "etopo",
  "ETOPO_2022_v1_60s_N90W180_bed.tif"
);

const ETOPO_WINDOW_BOUNDS = {
  west: 70,
  east: 140,
  south: 15,
  north: 55
};

let etopoSamplerPromise = null;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function buildReadWindow(width, height) {
  return [
    Math.floor(((ETOPO_WINDOW_BOUNDS.west + 180) / 360) * width),
    Math.floor(((90 - ETOPO_WINDOW_BOUNDS.north) / 180) * height),
    Math.ceil(((ETOPO_WINDOW_BOUNDS.east + 180) / 360) * width),
    Math.ceil(((90 - ETOPO_WINDOW_BOUNDS.south) / 180) * height)
  ];
}

function buildWindowBounds(window, width, height) {
  return {
    west: -180 + (window[0] / width) * 360,
    north: 90 - (window[1] / height) * 180,
    east: -180 + (window[2] / width) * 360,
    south: 90 - (window[3] / height) * 180
  };
}

async function collectTiffDiagnostics(image, window, fileSize) {
  const [compression, tileOffsets, tileByteCounts] = await Promise.all([
    image.fileDirectory.loadValue("Compression"),
    image.fileDirectory.loadValue("TileOffsets"),
    image.fileDirectory.loadValue("TileByteCounts")
  ]);
  const tileWidth = image.getTileWidth();
  const tileHeight = image.getTileHeight();
  const width = image.getWidth();
  const height = image.getHeight();
  const tilesPerRow = Math.ceil(width / tileWidth);
  const globalFirstInvalidTile = tileOffsets.findIndex(
    (offset, index) => Number(offset) + Number(tileByteCounts[index] ?? 0) > fileSize
  );
  const minTileX = Math.max(0, Math.floor(window[0] / tileWidth));
  const maxTileX = Math.min(tilesPerRow - 1, Math.floor((window[2] - 1) / tileWidth));
  const minTileY = Math.max(0, Math.floor(window[1] / tileHeight));
  const maxTileY = Math.min(Math.ceil(height / tileHeight) - 1, Math.floor((window[3] - 1) / tileHeight));

  let firstInvalidWindowTile = null;

  for (let tileY = minTileY; tileY <= maxTileY && !firstInvalidWindowTile; tileY += 1) {
    for (let tileX = minTileX; tileX <= maxTileX; tileX += 1) {
      const tileIndex = tileY * tilesPerRow + tileX;
      const offset = Number(tileOffsets[tileIndex] ?? NaN);
      const byteCount = Number(tileByteCounts[tileIndex] ?? NaN);

      if (!Number.isFinite(offset) || !Number.isFinite(byteCount) || offset + byteCount > fileSize) {
        firstInvalidWindowTile = { tileIndex, tileX, tileY, offset, byteCount };
        break;
      }
    }
  }

  return {
    compression,
    tileWidth,
    tileHeight,
    tilesPerRow,
    globalFirstInvalidTile,
    firstInvalidWindowTile
  };
}

async function loadEtopo() {
  const fileInfo = await fs.stat(ETOPO_TIFF_PATH);
  const tiff = await fromFile(ETOPO_TIFF_PATH);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const bbox = image.getBoundingBox();
  const window = buildReadWindow(width, height);

  let data;

  try {
    data = await image.readRasters({
      window,
      interleave: true,
      pool: null
    });
  } catch (error) {
    const diagnostics = await collectTiffDiagnostics(image, window, fileInfo.size);
    const reason = error instanceof Error ? error.message : String(error);

    throw new Error(
      [
        `ETOPO 60s TIFF read failed for ${ETOPO_TIFF_PATH}`,
        `reason=${reason}`,
        `window=[${window.join(", ")}]`,
        `bbox=[${bbox.join(", ")}]`,
        `imageSize=${width}x${height}`,
        `pool=null`,
        `compression=${diagnostics.compression}`,
        `tileSize=${diagnostics.tileWidth}x${diagnostics.tileHeight}`,
        `fileSize=${fileInfo.size}`,
        `globalFirstInvalidTile=${diagnostics.globalFirstInvalidTile}`,
        diagnostics.firstInvalidWindowTile
          ? `windowFirstInvalidTile=${JSON.stringify(diagnostics.firstInvalidWindowTile)}`
          : "windowFirstInvalidTile=null"
      ].join("\n")
    );
  }

  const bounds = buildWindowBounds(window, width, height);

  return {
    data,
    winWidth: window[2] - window[0],
    winHeight: window[3] - window[1],
    sourcePath: ETOPO_TIFF_PATH,
    ...bounds
  };
}

function buildSampler({ data, winWidth, winHeight, sourcePath, west, north, east, south }) {
  function sample(lon, lat) {
    if (lon < west || lon > east || lat < south || lat > north) {
      return 0;
    }

    const u = (lon - west) / (east - west || 1);
    const v = (north - lat) / (north - south || 1);
    const column = clamp(Math.round(u * (winWidth - 1)), 0, winWidth - 1);
    const row = clamp(Math.round(v * (winHeight - 1)), 0, winHeight - 1);
    const meters = data[row * winWidth + column];

    return Number.isFinite(meters) && meters > -10000 ? meters : 0;
  }

  // 给 build pipeline 用：在 overlap 区域上均匀采 width×height 个点，返回扁平
  // 数组（row-major，行从 north 到 south，列从 west 到 east）。
  // 调用 ~tens of thousands of times per build, 避免 per-cell async overhead。
  function sampleGrid(overlap, gridWidth, gridHeight) {
    const out = new Float32Array(gridWidth * gridHeight);
    const lonSpan = (overlap.east - overlap.west) / Math.max(1, gridWidth - 1);
    const latSpan = (overlap.north - overlap.south) / Math.max(1, gridHeight - 1);

    for (let row = 0; row < gridHeight; row += 1) {
      const lat = overlap.north - row * latSpan;
      for (let col = 0; col < gridWidth; col += 1) {
        const lon = overlap.west + col * lonSpan;
        out[row * gridWidth + col] = sample(lon, lat);
      }
    }

    return out;
  }

  return {
    sourcePath,
    sample,
    sampleGrid
  };
}

export async function getEtopoSampler() {
  if (!etopoSamplerPromise) {
    etopoSamplerPromise = (async () => buildSampler(await loadEtopo()))();
  }

  return etopoSamplerPromise;
}
