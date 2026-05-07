import { fromFile } from "geotiff";

import { qinlingWorkspacePath } from "./qinling-dem-common.mjs";

const HYDROSHEDS_TIFF_PATH = qinlingWorkspacePath(
  "data",
  "hydrosheds",
  "hyd_as_dem_15s.tif"
);

let samplerPromise = null;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

async function loadHydroSheds() {
  const tiff = await fromFile(HYDROSHEDS_TIFF_PATH);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const bbox = image.getBoundingBox();

  // 整个 Asia 幅面太大，只缓存中国 bounds + 0.5° margin。
  const targetWest = 72.5;
  const targetEast = 135.5;
  const targetSouth = 17.5;
  const targetNorth = 53.5;

  const x0 = clamp(
    Math.floor(((targetWest - bbox[0]) / (bbox[2] - bbox[0])) * width),
    0,
    width - 1
  );
  const y0 = clamp(
    Math.floor(((bbox[3] - targetNorth) / (bbox[3] - bbox[1])) * height),
    0,
    height - 1
  );
  const x1 = clamp(
    Math.ceil(((targetEast - bbox[0]) / (bbox[2] - bbox[0])) * width),
    x0 + 1,
    width
  );
  const y1 = clamp(
    Math.ceil(((bbox[3] - targetSouth) / (bbox[3] - bbox[1])) * height),
    y0 + 1,
    height
  );

  const window = [x0, y0, x1, y1];
  const rasters = await image.readRasters({ window });
  const data = rasters[0];
  const winWidth = window[2] - window[0];
  const winHeight = window[3] - window[1];
  const winWest = bbox[0] + (window[0] / width) * (bbox[2] - bbox[0]);
  const winEast = bbox[0] + (window[2] / width) * (bbox[2] - bbox[0]);
  const winNorth = bbox[3] - (window[1] / height) * (bbox[3] - bbox[1]);
  const winSouth = bbox[3] - (window[3] / height) * (bbox[3] - bbox[1]);

  return {
    data,
    winWidth,
    winHeight,
    winWest,
    winEast,
    winNorth,
    winSouth,
    sourcePath: HYDROSHEDS_TIFF_PATH
  };
}

function buildSampler({
  data,
  winWidth,
  winHeight,
  winWest,
  winEast,
  winNorth,
  winSouth,
  sourcePath
}) {
  function sample(lon, lat) {
    if (lon < winWest || lon > winEast || lat < winSouth || lat > winNorth) {
      return 0;
    }

    const u = (lon - winWest) / (winEast - winWest || 1);
    const v = (winNorth - lat) / (winNorth - winSouth || 1);
    const column = clamp(Math.round(u * (winWidth - 1)), 0, winWidth - 1);
    const row = clamp(Math.round(v * (winHeight - 1)), 0, winHeight - 1);
    const meters = data[row * winWidth + column];

    // HydroSHEDS nodata = -32768；海洋 / 出界统一回到 0。
    return Number.isFinite(meters) && meters > -10000 ? meters : 0;
  }

  function sampleGrid(overlap, gridWidth, gridHeight) {
    const out = new Float32Array(gridWidth * gridHeight);
    const lonStep = (overlap.east - overlap.west) / Math.max(1, gridWidth - 1);
    const latStep = (overlap.north - overlap.south) / Math.max(1, gridHeight - 1);

    for (let row = 0; row < gridHeight; row += 1) {
      const lat = overlap.north - row * latStep;

      for (let column = 0; column < gridWidth; column += 1) {
        const lon = overlap.west + column * lonStep;
        out[row * gridWidth + column] = sample(lon, lat);
      }
    }

    return out;
  }

  return { sourcePath, sample, sampleGrid };
}

export async function getHydroShedsSampler() {
  if (!samplerPromise) {
    samplerPromise = (async () => buildSampler(await loadHydroSheds()))();
  }

  return samplerPromise;
}
