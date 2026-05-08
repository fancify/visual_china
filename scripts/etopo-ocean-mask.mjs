// ETOPO ocean mask 采样器
//
// HydroSHEDS 是 void-filled 陆地 DEM，海洋统一 0，无法区分"沿海低地 0m"vs
// "深海"。Build pipeline 用这个 helper 单独读 ETOPO 全球 1.85km 数据，仅判定
// "这一点是不是海洋"，不参与陆地高度计算。
//
// 阈值：ETOPO bathymetry < -10m 视为海。冰架/盐田/海港边可能 ±10m，10m 阈值
// 排除这些边缘暧昧区。
//
// 单例 cache：第一次调用读取 ETOPO 中国 window (~30 MB Int16) 入内存，后续
// sample 是 O(1) 数组索引。

import { fromFile } from "geotiff";
import { qinlingWorkspacePath } from "./qinling-dem-common.mjs";

const ETOPO_TIFF_PATH = qinlingWorkspacePath(
  "data",
  "etopo",
  "ETOPO_2022_v1_60s_N90W180_bed.tif"
);

const WINDOW_BOUNDS = { west: 70, east: 140, south: 15, north: 55 };

let samplerPromise = null;

async function loadSampler() {
  const tiff = await fromFile(ETOPO_TIFF_PATH);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const bbox = image.getBoundingBox();

  const window = [
    Math.floor(((WINDOW_BOUNDS.west - bbox[0]) / (bbox[2] - bbox[0])) * width),
    Math.floor(((bbox[3] - WINDOW_BOUNDS.north) / (bbox[3] - bbox[1])) * height),
    Math.ceil(((WINDOW_BOUNDS.east - bbox[0]) / (bbox[2] - bbox[0])) * width),
    Math.ceil(((bbox[3] - WINDOW_BOUNDS.south) / (bbox[3] - bbox[1])) * height)
  ];

  const rasters = await image.readRasters({ window });
  const data = rasters[0];
  const winW = window[2] - window[0];
  const winH = window[3] - window[1];

  const winWest = bbox[0] + (window[0] / width) * (bbox[2] - bbox[0]);
  const winEast = bbox[0] + (window[2] / width) * (bbox[2] - bbox[0]);
  const winNorth = bbox[3] - (window[1] / height) * (bbox[3] - bbox[1]);
  const winSouth = bbox[3] - (window[3] / height) * (bbox[3] - bbox[1]);

  return {
    isOcean(lon, lat) {
      if (lon < winWest || lon > winEast || lat < winSouth || lat > winNorth) {
        return false;
      }
      const u = (lon - winWest) / (winEast - winWest);
      const v = (winNorth - lat) / (winNorth - winSouth);
      const col = Math.min(winW - 1, Math.max(0, Math.round(u * (winW - 1))));
      const row = Math.min(winH - 1, Math.max(0, Math.round(v * (winH - 1))));
      const meters = data[row * winW + col];
      return Number.isFinite(meters) && meters > -10000 && meters < -10;
    }
  };
}

export async function getEtopoOceanSampler() {
  if (!samplerPromise) {
    samplerPromise = loadSampler();
  }
  return samplerPromise;
}
