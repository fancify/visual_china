import path from "node:path";

import { chinaBounds, workspacePath } from "./china-dem-common.mjs";

export const etopoLowresSource = {
  name: "ETOPO 2022 60 arc-second",
  globalGeoTiffUrl:
    "https://www.ngdc.noaa.gov/mgg/global/relief/ETOPO2022/data/60s/60s_bed_elev_gtif/ETOPO_2022_v1_60s_N90W180_bed.tif",
  opendapDatasetUrl:
    "https://www.ngdc.noaa.gov/thredds/dodsC/global/ETOPO2022/60s/60s_bed_elev_netcdf/ETOPO_2022_v1_60s_N90W180_bed.nc",
  subsetFileName: "china-etopo-2022-60s-stride7.ascii",
  subsetStride: 7,
  subsetIndices: {
    latStart: 6480,
    latEnd: 8640,
    lonStart: 15180,
    lonEnd: 18900
  },
  citation:
    "NOAA National Centers for Environmental Information. 2022: ETOPO 2022 15 Arc-Second Global Relief Model. https://doi.org/10.25921/fd45-gt74"
};

export const chinaLowresOutput = {
  columns: 532,
  rows: 309
};

export const chinaLowresSourcePath = workspacePath(
  "data",
  "etopo",
  etopoLowresSource.subsetFileName
);

export const chinaLowresOutputPath = workspacePath(
  "public",
  "data",
  "china-lowres-dem.json"
);

export function chinaLowresManifestPath(...parts) {
  return path.join(workspacePath("data", "etopo"), ...parts);
}

export { chinaBounds };
