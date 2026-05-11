#!/usr/bin/env node
// SSOT manifest runner — 替换 package.json 里的 80+ 路径长串。
// codex round 6 (PM audit) 建议：用 manifest 而非 inline scripts，降低维护成本。
//
// 用法:
//   node scripts/test-groups.mjs fast     # ~200ms 契约/数学/SSOT 守卫
//   node scripts/test-groups.mjs visual   # ~36s 渲染/几何/runtime
//   node scripts/test-groups.mjs data     # ~1s DEM/POI/atlas validation
//   node scripts/test-groups.mjs audio    # ~100ms 音频子系统
//   node scripts/test-groups.mjs ci       # typecheck + fast + audio (CI 默认)
//   node scripts/test-groups.mjs all      # 全部依次跑（同 npm test）
//
// 加新 test 文件时：append 到下面对应 group 数组即可，package.json 不动。

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scriptsDir = path.relative(process.cwd(), __dirname) || ".";

/** Test groups — 加新 test 时按 group 性质 append 这里 */
const GROUPS = {
  // 纯契约 / 数学 / 状态机 / SSOT 守卫，全部 < 50ms，CI 必跑
  fast: [
    "world-axis-contract",
    "world-coordinate-contract",
    "input-state",
    "navigation-controls",
    "compass-orientation",
    "camera-view",
    "camera-map-projection",
    "text-label-layout",
    "perf-monitor",
    "ground-anchor-registry",
    "regression-baseline",   // S1 19-case snapshot
    "ssot-drift",            // SSOT round 5 守卫
    "surface-provider"       // S3 SurfaceProvider contract + 默认实现
  ],

  // 渲染 / 几何 / runtime — 用 mock scene + threejs，慢
  visual: [
    "qinling-landform-visual",
    "qinling-chunk-seams",
    "terrain-city-regressions",
    "environment-celestial",
    "weather-transition",
    "sky-disc-position",
    "sky-dome-runtime",
    "sky-atmosphere-runtime",
    "terrain-atmospheric-haze",
    "cloud-cookie",
    "cloud-planes",
    "scenery-shader-enhancer",
    "grass-biome",
    "city-floor-occlusion",
    "cast-shadow-policy",
    "hud-chrome",
    "hud-proximity",
    "hud-hover-runtime",
    "scenic-poi-visuals",
    "ancient-poi-visuals",
    "route-ribbon",
    "plank-road-renderer",
    "player-avatar",
    "player-avatar-scale",
    "avatar-arm-rig",
    "avatar-monk-geometry",
    "avatar-slope-tilt",
    "water-system-visuals",
    "biome-zones",
    "biome-seasonal",
    "scenery-plant-kinds",
    "poi-occlusion-runtime",
    "label-lod",
    "mount-fox-geometry",
    "mount-pig-geometry",
    "mount-boar-geometry",
    "mount-chicken-geometry",
    "mount-cloud-geometry",
    "mount-speeds",
    "landmark-pass-geometry",
    "city-flatten-zones",
    "wildlife"
  ],

  // 数据 / asset / atlas / hydrography validation
  data: [
    "qinling-dem-status",
    "real-elevation",
    "real-cities",
    "china-lowres-dem",
    "china-lowres-demo-page",
    "china-lakes",
    "qinling-poi-geography",
    "imperial-tombs",
    "qinling-route-affinity",
    "qinling-routes-anchors",
    "build-shu-road-paths",
    "qinling-route-paths",
    "composite-terrain-sampler",
    "chunk-lod-heights",
    "terrain-lod-dispatcher",
    "terrain-mesh-lod-stitch",
    "qinling-atlas-coverage",
    "atlas-render-policy",
    "atlas-workbench-state",
    "hydrography-model",
    "qinling-hydrography-asset",
    "qinling-primary-hydrography-asset",
    "hydrography-atlas",
    "hydrography-dem-validation",
    "qinling-hydrography-report",
    "osm-hydrography-normalize",
    "osm-overpass-query",
    "osm-hydrography-atlas",
    "qinling-osm-hydrography-asset"
  ],

  audio: [
    "audio-mixer",
    "audio-trigger",
    "audio-sparse-scheduler",
    "audio-debug-hud"
  ]
};

/** Composite groups */
const COMPOSITES = {
  // CI 默认：typecheck + 快速契约 + 音频；不跑 visual/data 那 30s+
  ci: ["fast", "audio"],
  all: ["fast", "visual", "data", "audio"]
};

const arg = process.argv[2];

if (!arg) {
  console.error("usage: node scripts/test-groups.mjs <fast|visual|data|audio|ci|all>");
  process.exit(2);
}

function filesFor(group) {
  if (GROUPS[group]) {
    return GROUPS[group].map((stem) => `${scriptsDir}/${stem}.test.mjs`);
  }
  if (COMPOSITES[group]) {
    return COMPOSITES[group].flatMap((g) => filesFor(g));
  }
  console.error(`unknown group: ${group}`);
  console.error(`available: ${[...Object.keys(GROUPS), ...Object.keys(COMPOSITES)].join(", ")}`);
  process.exit(2);
}

const files = filesFor(arg);
const nodeArgs = ["--max-old-space-size=8192", "--test", ...files];

console.log(`[test-groups] running '${arg}' (${files.length} files)`);

const child = spawn(process.execPath, nodeArgs, { stdio: "inherit" });
child.on("exit", (code) => process.exit(code ?? 1));
