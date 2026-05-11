---
type: plan
status: wip
tags: [architecture, design]
updated: 2026-05-12
---

# Terrain Rewrite v2 — 单源 FABDEM + 多 LOD pyramid

> 2026-05-12 启动 · branch `feature/terrain-rewrite-v2`
> 用户要求：解 6 个穿模 bug + "方的不是圆的" + 死绸带河水 + 海洋漫灌 → BotW / 长安三万里 写实地形

## 目标

| ID | 症状 | 根因 | 本次修法 |
|---|---|---|---|
| B1 | 植物穿模 | scenery Y 不走 SurfaceProvider | 接 P5 surfaceProvider |
| B2 | 河流穿模 / z-fight | river vertex tint on base + 高低 mesh 不齐 | 删 vertex tint，新 ribbon mesh P4 |
| B3 | 城市穿模 | cityFlattenZones Y 不走 chunk-aware sampler | P5 切到新 sampler |
| B4 | 古道穿模 | route polyline Y 不走 sampler | P5 同上 |
| B5 | 人物穿模 | （S3b 已修 ✅） | 保（验证） |
| B6 | "方的不是圆的" | chunk 硬切，无 LOD morph | P3 multi-LOD shader + chunk feather |
| B7 | 海洋漫灌 | water plane Y < terrain 任意低洼 | P4 ocean polygon mask（仅 coastline 内画水） |
| B8 | 死绸带河水 | static vertex color，无 shader 动效 | P4 ribbon mesh + UV scroll + foam + fresnel |

## 数据决定

### 单源 FABDEM V1-2

- **唯一 DEM 源**：FABDEM V1-2 30m raw（`data/fabdem/china/tiles/*.tif` + 补下完整后）
- **理由**：bare-earth（剥森林+建筑），±2m 准确度，Hawker et al. 2022。HydroSHEDS DEM 是 "hydrologically conditioned"（故意改过的非真实地形），不能当 geometry truth source。
- **下线**：ETOPO 60s（672 MB）+ HydroSHEDS DEM `hyd_as_dem_15s.tif`（162 MB）。HydroSHEDS HydroRIVERS shapefile **保留**用作河流 vector。

### LOD pyramid（2× chain）

| Tier | cell 精度 | chunk 物理 | 适用半径 | 全图 chunks | 单 chunk | 全图磁盘 |
|---|---|---|---|---|---|---|
| **L0** | 450 m | 28.8 × 28.8 km（64×64 verts） | 0-15 km | ~6,500 | 8 KB Float16 | ~52 MB |
| L1 | 900 m | 57.6 × 57.6 km | 15-50 km | ~1,650 | 8 KB | ~13 MB |
| L2 | 1.8 km | 115 × 115 km | 50-150 km | ~410 | 8 KB | ~3.3 MB |
| L3 | 3.6 km | 230 × 230 km | 150-500 km | ~100 | 8 KB | ~0.8 MB |
| L4 | 7.2 km | 460 × 460 km | 整图底 | ~25 | 8 KB | ~0.2 MB |
| **总** | — | — | — | ~8,700 | — | **~70 MB** |

- 比当前 `public/data/regions/qinling/` 2.2 GB 小 30×
- 玩家 runtime memory ~400-500 KB 同时 loaded（visible chunks across tiers）
- 玩家上限下载 70 MB（走遍 China）

### 水系 / 海洋 overlay

| 数据 | 源 | 处理 | 渲染 |
|---|---|---|---|
| 河流 | HydroSHEDS HydroRIVERS shp | 投影 → world coords → 按 L0 chunk grid 切 → polyline JSON | ribbon mesh + UV scroll + fresnel + foam |
| 湖泊 | HydroLAKES polygon（如有） | 同上 → polygon JSON | flat polygon at lake surface elev |
| 海岸 | FABDEM elev ≤ 0 + Natural Earth 10m coastline（augment） | 派生 ocean mask polygon | sea-level plane 内部填充，外部裁掉 |

## 文件改动清单（confirmed）

### 🔥 删除（rewrite-from-scratch）

| 文件 | 行 | 替代物 |
|---|---|---|
| `src/game/terrainMesh.ts` | 201 | 新 `src/game/terrain/pyramidMesh.ts` |
| `src/game/terrainModel.ts` | 257 | 新 `src/game/terrain/materialShader.ts`（slope-driven）|
| `src/game/terrainShaderEnhancer.ts` | 446 | 新 `src/game/terrain/atmosphereShader.ts` |
| `src/game/terrainMeshFrustum.ts` | 13 | 合并进新 pyramidMesh |
| `src/game/hydrographyAtlas.ts/.js` | ~ | 新 `src/game/terrain/riverRenderer.ts` |
| `src/game/osmHydrographyAtlas.ts/.js` | ~ | 同上吸收 |

### 🔥 main.ts 大段重写

| 段 | 行 | 改成 |
|---|---|---|
| `underpaint` Mesh (745-757) | ~15 | 删（ocean 在新 oceanRenderer） |
| `waterRibbon` (804-815) | ~12 | 删 |
| `loadHydrographyAtlas()` (427-452) | ~25 | 删，新 `riverRenderer.bootstrap()` 接管 |
| `applyTerrainFromSampler()` (5912-6184) | ~270 | 改成 `terrainRenderer.bootstrap()` 单入口 |
| chunk load 段 (4401-4599) | ~200 | 改成新 `pyramidLoader.updateVisible()` |

### ⚙️ 改（callsite migration）

| 文件 | 改动 |
|---|---|
| `src/game/scenery.ts` | ~5-10 callsite 切到新 SurfaceProvider |
| `src/game/cityFlattenZones.ts` | 同上 |
| `src/game/routeRibbon.ts/.js` | route Y anchor |
| `src/game/qinlingRoutes.ts/.js` | 同上 |
| `src/game/plankRoadRenderer.ts` | 栈道 Y anchor |
| `src/game/wildlife.ts` | 动物 Y anchor |
| `src/game/surfaceProvider.ts` | **接口保留**（S3a 契约），新实现替换 |

### ✂️ demSampler.ts (1112 行) 拆分

| 段 | 处置 |
|---|---|
| `TerrainSampler` class | **删**——替换为新 PyramidSampler |
| `CompositeTerrainSampler` class | **删**——chunk registry 进新 pyramidLoader |
| `downsampleChunkAsset()` | **删**——pyramid 烤时 build-side 处理 |
| `DemAsset` interface | **改**——新二进制 schema |
| `TERRAIN_VERTICAL_EXAGGERATION` constant | **保**——多 module import |
| sampler 方法签名 | **保契约**（移到 SurfaceProvider impl） |

### 🧪 测试

| 测试 | 行 | 处置 |
|---|---|---|
| `terrain-city-regressions.test.mjs` | 583 | 改 ~50 行 |
| `qinling-landform-visual.test.mjs` | 380 | **重写** |
| `terrain-atmospheric-haze.test.mjs` | 76 | **重写** |
| `chunk-lod-heights.test.mjs` | 46 | **重写** |
| `terrain-lod-dispatcher.test.mjs` | 41 | **重写** |
| `terrain-mesh-lod-stitch.test.mjs` | 16 | **重写** |
| `regression-baseline.test.mjs` | 19 case | **保**（contract snapshot） |
| 其余 87 测试 | — | 不动 |

## Phase 计划

| Phase | 内容 | 估时 | 可见交付 |
|---|---|---|---|
| **P0** | 起分支 + 写本 plan doc（本次 commit）| 0.5 天 | 本文档 |
| **P1** | `scripts/build-dem-pyramid.mjs` ——FABDEM raw → L0-L4 binary chunks | 2 天 | `public/data/dem/L*/` pyramid 数据 |
| **P2** | `scripts/build-rivers-chunked.mjs` + `build-coast-mask.mjs` | 1 天 | rivers + coast JSON |
| **P3** | 新 renderer `src/game/terrain/`（pyramidLoader + pyramidMesh + morphShader + surfaceProvider） | 2-3 天 | 网页跑通新 multi-LOD 地形（旧水/scenery 还在）|
| **P4** | river ribbon + ocean coast mask | 1 天 | 河水 + 海岸正确 |
| **P5** | scenery / cities / routes / wildlife 全切到新 SurfaceProvider | 1 天 | 6 个穿模 bug 消失 |
| **P6** | 删旧 terrain 文件 + 旧 chunks data | 0.5 天 | 最终 clean state |
| **总** | — | **~8-9 天** | |

## Invariants（必须守住）

1. **单源**：所有 DEM 数据从 FABDEM raw 派生
2. **同 projection**：5 个 tier 共享 strict-geographic projection（SSOT）
3. **chunk 对齐**：L_n 一个 chunk 边界 = L_{n+1} 一个 chunk 边界 / 4
4. **接口兼容**：新 SurfaceProvider 实现旧契约（S3a），player/scenery/HUD/audio callsite 零改动
5. **测试 baseline**：当前 95 fast + 6 visual + 9 data + 6 audio 全跑通

## 依赖

- ⏳ **FABDEM 补下载**（进行中 task #186）：29 archives ≈ 45-55 GB，估 8-15 hr。P1 ingestion 必须等它完成。
- ✅ 现有 SurfaceProvider 契约（S3a/S3b ship）
- ✅ EpochManifest 框架（S4a ship）——pyramid 数据通过 `region.manifest` 注入

## 风险

- **下载失败 / Bristol 服务器限速**：脚本有 dedup，单 archive 失败重试即可；最坏 fallback 是 slice 缩小（已讨论方案 B）
- **L0 450m 仍嫌粗**：留 P7（30m streaming）作未来扩展，本次 P1-P6 不阻挡
- **chunk T-junction**（相邻 tier 边界 vertex 不连续）：用 outer-ring skirt 兜底，最坏视觉上是细线接缝
- **新 renderer 跑不起来**：P3-P5 完成前旧 renderer 保留（feature flag 切换），fallback 安全

## 不在本次 scope（明确推后）

- ❌ S4b Tang 数据 sourcing（吐蕃/西域/南诏 cities + routes + POI）
- ❌ Cel-shading toggle（P4-P5 后视觉 polish 阶段考虑）
- ❌ 草响应玩家 / wind 系统（BotW 80 项里更后排）
- ❌ Atmospheric scattering（atmosphereShader 是 fog 重写，不做全大气模型）
- ❌ 真体积云、真草、24 节气独立 shader、normal map（todo.md 不做清单）
