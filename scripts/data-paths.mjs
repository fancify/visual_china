// SSOT (2026-05-11): 集中所有 build/verify/runtime 用到的 data path。
// codex SSOT 审计修复——之前 6+ 处硬编码 path 字符串散落在 build scripts /
// verify / runtime，改 path 时容易漏改导致脚本跑错资产。
//
// 用法：
//   import { LEGACY_SLICE_DEM, QINLING_REGION_MANIFEST } from "./data-paths.mjs";
//   const asset = JSON.parse(fs.readFileSync(LEGACY_SLICE_DEM, "utf8"));
//
// 运行时（src/main.ts）的 URL 形式 (`/data/regions/...`) 是 vite 的 public/
// rewrite 规则；这里只管 build/test 端的相对路径。

import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function p(...segments) {
  return path.join(projectRoot, ...segments);
}

// ─── Legacy single-slice DEM (build:dem 旧产物，仍被多个验证脚本引用) ───
// S4 epoch schema 落地后这些资产会迁到 epochs/modern/，遗留 path 标记 deprecated。
export const LEGACY_SLICE_DEM = p("public", "data", "qinling-slice-dem.json");

// ─── 当前 region manifest (运行时默认入口) ───
export const QINLING_REGION_MANIFEST = p("public", "data", "regions", "qinling", "manifest.json");
export const QINLING_REGION_SLICE_L1 = p("public", "data", "regions", "qinling", "slice-l1.json");
export const QINLING_CHUNK_MANIFEST = p("public", "data", "regions", "qinling", "chunks", "manifest.json");
export const QINLING_POI_MANIFEST = p("public", "data", "regions", "qinling", "poi", "manifest.json");
export const QINLING_POI_CONTENT = p("public", "data", "regions", "qinling", "poi", "content.json");

// ─── 全国 DEM ───
export const CHINA_LOWRES_DEM = p("public", "data", "china-lowres-dem.json");
export const CHINA_NATIONAL_DEM = p("public", "data", "china-national-dem.json");

// ─── Hydrography ───
export const QINLING_OSM_HYDROGRAPHY = p("public", "data", "regions", "qinling", "hydrography", "osm-modern.json");
export const QINLING_PRIMARY_HYDROGRAPHY = p("public", "data", "regions", "qinling", "hydrography", "primary-modern.json");
export const QINLING_HYDROGRAPHY_REPORT = p("public", "data", "regions", "qinling", "hydrography", "dem-validation-report.json");

// ─── Routes ───
export const QINLING_ROUTE_ANCHORS_OUTPUT = p("src", "game", "data", "qinlingRouteAnchors.js");
export const QINLING_ROUTE_PATHS_OUTPUT = p("src", "game", "data", "qinlingRoutePaths.js");

// ─── External raw data (FABDEM / HydroSHEDS / NaturalEarth) ───
export const DATA_FABDEM = p("data", "fabdem");
export const DATA_ETOPO = p("data", "etopo");
export const DATA_HYDROSHEDS = p("data", "hydrosheds");
export const DATA_NATURAL_EARTH = p("data", "natural-earth");

// ─── Runtime URL forms (for `?dem=` query params, vite serves /data/) ───
// 这一组是 URL，不是 filesystem path，对应 src/main.ts default `?dem=` fallback.
export const URL_QINLING_REGION_MANIFEST = "/data/regions/qinling/manifest.json";
export const URL_CHINA_LOWRES_DEM = "/data/china-lowres-dem.json";
