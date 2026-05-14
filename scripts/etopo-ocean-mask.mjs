// ETOPO ocean mask 采样器
//
// HydroSHEDS 是 void-filled 陆地 DEM，海洋统一 0，无法区分"沿海低地 0m"vs
// "深海"。Build pipeline 用这个 helper 单独读 ETOPO 全球 1.85km 数据，仅判定
// "这一点是不是海洋"，不参与陆地高度计算。
//
// 阈值：ETOPO bathymetry < -0.5m 视为海。旧版 < -10m 会把杭州湾、长江口、
// 渤海这类浅海当陆地回填成 0m 平板，挡住 ocean plane。
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

export function classifyEtopoMeters(meters) {
  if (!Number.isFinite(meters) || meters <= -10000) return "unknown";
  return meters < -0.5 ? "ocean" : "land";
}

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

  function sampleMeters(lon, lat) {
    if (lon < winWest || lon > winEast || lat < winSouth || lat > winNorth) {
      return Number.NaN;
    }
    const u = (lon - winWest) / (winEast - winWest);
    const v = (winNorth - lat) / (winNorth - winSouth);
    const col = Math.min(winW - 1, Math.max(0, Math.round(u * (winW - 1))));
    const row = Math.min(winH - 1, Math.max(0, Math.round(v * (winH - 1))));
    const meters = data[row * winW + col];
    return Number.isFinite(meters) ? meters : Number.NaN;
  }
  return {
    isOcean(lon, lat) {
      const m = sampleMeters(lon, lat);
      return classifyEtopoMeters(m) === "ocean";
    },
    // FABDEM 数据洞补救: 返回 ETOPO 海拔 (m). 海里返回 NaN 让 caller 知道这是海.
    sampleLandElevation(lon, lat) {
      const m = sampleMeters(lon, lat);
      if (classifyEtopoMeters(m) !== "land") return Number.NaN;
      return m; // 陆地 / 浅滩 (-10 到 +8000m)
    }
  };
}

export async function getEtopoOceanSampler() {
  if (!samplerPromise) {
    samplerPromise = loadSampler();
  }
  return samplerPromise;
}
