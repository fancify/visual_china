# 山河中国 · 架构

> **一页读懂**：项目目标、当前结构、目标结构（S3-S7 后）、与传统游戏项目的差异
> 更新：2026-05-11

## 一句话

浏览器端 3D "中国地理叙事" 原型——以严格地理坐标在中国地貌中漫游，第一个时代切片为唐玄宗天宝十四年 (755 AD)。Three.js + TypeScript + Vite，无后端。

## 当前结构 (2026-05-11)

```
visual_china/
├── ARCHITECTURE.md           ← 本文件
├── README.md                 ← 用户视角入口
├── CLAUDE.md                 ← AI 协作约定 (项目本地)
├── tsconfig.json             ← strict + ES2023 + Bundler resolution
├── package.json              ← 4-stage test split + build + dev
├── todo.md                   ← 当前 7-step refactor 进度
├── index.html                ← 主游戏入口
├── china-lowres.html         ← 全国低分辨率 demo 入口
│
├── src/
│   ├── main.ts               ← 6263 行 god file (S5 将拆 6 runtime)
│   ├── chinaLowresDemo.ts    ← lowres demo 入口
│   ├── style.css
│   ├── data/                 ← 静态数据 + manifest types
│   │   ├── realCities.js     ← 城市坐标 (Tang 名 + id 待 S4 同步)
│   │   ├── qinlingRegion.js  ← world bounds/depth SSOT
│   │   ├── qinlingSlice.ts   ← landmarks + view modes
│   │   └── fragments.ts      ← 知识收集 data
│   ├── game/                 ← 75 .ts canonical + .js shim (flat, S5 将按 runtime 拆 subfolder)
│   │   ├── demSampler.ts     ← terrain 采样 (TERRAIN_VERTICAL_EXAGGERATION SSOT)
│   │   ├── environment.ts    ← weather/season/time SSOT
│   │   ├── qinlingAtlas.ts   ← 2D atlas 数据 + types
│   │   ├── waterSystemVisuals.ts
│   │   ├── ... (其他 70+ 模块)
│   │   ├── audio/            ← 唯一已 subfolder 的子系统
│   │   ├── mounts/           ← mount 几何 builder
│   │   └── data/             ← runtime-loaded 数据
│   ├── test/
│   │   └── regressionCases.ts  ← (S1 占位)
│   └── types/
│
├── scripts/                  ← build / fetch / verify / tests 混在一起 (待 PM 评估)
│   ├── *.test.mjs (80+)      ← 单元 / contract / visual 测试
│   ├── build-*.mjs           ← DEM / hydrography / routes 构建
│   ├── download-*.mjs        ← FABDEM / OSM / NaturalEarth 抓取
│   ├── verify-*.mjs          ← asset 校验
│   ├── data-paths.mjs        ← 路径 SSOT (新)
│   └── ssot-drift.test.mjs   ← manifest 漂移守卫 (新)
│
├── public/
│   ├── data/                 ← runtime artifact (manifest / DEM / chunks / POI)
│   └── sfx/                  ← 音频资产
│
├── docs/                     ← active 文档
│   ├── README.md             ← 文档入口
│   ├── context-summary.md    ← 当前架构 + S1-S6 进度
│   ├── regression-baseline-2026-05-11.md
│   ├── tang-epoch-755-poi-database.md  ← Tang 数据 v0 (S4 将迁 JSON)
│   ├── botw-immersion-learning-roadmap.md
│   └── ... (architecture/data spec docs)
│
├── .archive/                 ← 历史归档 (docs / scripts / todo)
├── data/                     ← 大文件源（FABDEM / HydroSHEDS, gitignored）
└── tmp/, dist/, node_modules/
```

## 模块依赖层次（当前）

```
┌─────────────────────────────────────────────────┐
│ index.html / china-lowres.html                  │
└────────────────────┬────────────────────────────┘
                     ▼
┌─────────────────────────────────────────────────┐
│ src/main.ts (6263 行 — 一切都在这)              │
│   - scene init / frame loop                     │
│   - input wiring                                │
│   - HUD / atlas controllers                     │
│   - chunk streaming / LOD                       │
│   - rebuild visuals (cities / POI / fragments)  │
│   - audio mixer                                 │
│   - player customization                        │
└──┬───────────────────────────────────────────────┘
   │ imports
   ▼
┌──────────────────────────────────────────────────┐
│ src/game/* (75 modules)                          │
│  - 大多 single-file modules (demSampler,         │
│    environment, qinlingAtlas, scenery 等)       │
│  - 部分子目录: audio/, mounts/, data/            │
└──┬───────────────────────────────────────────────┘
   │
   ▼
┌──────────────────────────────────────────────────┐
│ src/data/* (静态数据)                            │
│  - realCities, qinlingRegion, qinlingSlice,     │
│    fragments                                     │
└──┬───────────────────────────────────────────────┘
   │
   ▼
   public/data/* (runtime DEM/manifest/POI assets)
```

## 目标架构 (S5 Runtime Split 后)

```
src/main.ts (~1500 行)
  - boot + input wiring + frame scheduler ONLY

src/game/
├── runtime/
│   ├── TerrainRuntime.ts     ← chunks, base mesh, LOD morph
│   ├── SurfaceRuntime.ts     ← SurfaceProvider + anchors (S3)
│   ├── WaterRuntime.ts       ← river / lake / ocean render
│   ├── ContentRuntime.ts     ← POI / cities / routes / story (epoch-aware)
│   ├── EnvironmentRuntime.ts ← time / season / weather / wind / AudioDirector
│   └── PlayerRuntime.ts      ← movement / camera / avatar / audio triggers
├── contracts/
│   ├── SurfaceProvider.ts    ← S3 deliverable
│   ├── EpochManifest.ts      ← S4 deliverable
│   └── RenderLayerPolicy.ts  ← S5 SSOT
├── terrain/                  ← 现 demSampler / terrainMesh / chunkLod 等
├── water/                    ← 现 hydrography / waterSystemVisuals 等
├── camera/                   ← 现 cameraView / cameraRig 等
├── environment/              ← 现 environment / cloudPlanes / sky 等
├── player/                   ← 现 avatars / mounts / playerCustomization 等
├── poi/                      ← 现 scenicPoiVisuals / cityMarkers 等
├── atlas/                    ← 现 qinlingAtlas / atlasRender 等
├── audio/                    ← 已有
└── hud/                      ← 现 hud / hudChrome / labels

public/data/epochs/           ← S4 epoch artifacts
├── modern/
│   └── manifest.json
└── tang-tianbao-14/
    ├── manifest.json
    ├── cities.json           ← 从 tang-epoch-755-poi-database.md 迁过来
    ├── hydrography.json      ← Tang 水系
    └── routes.json
```

## 关键约定

详见 [CLAUDE.md](./CLAUDE.md)。要点：

- **TypeScript canonical** — `.ts` 是源，`.js` 是 raw-node 测试 shim (`export * from "./X.ts"`)
- **SSOT-by-design** — 同一事实只能一个 authoring source（见 `memory/feedback_ssot_by_design.md`）
- **测试分两类** — contract snapshot test（regression-baseline）vs 普通一致性测试
- **Manifest 是 build artifact**，不是 authoring source（`scripts/ssot-drift.test.mjs` 守住这一点）

## 与传统游戏项目的差异

- **没有"editor"**——所有内容用 markdown / JSON / TS 直接 author，没有 Unity/Unreal-style GUI 编辑器
- **静态数据 + procedural runtime**——城市/路线/POI 是数据，地形/植被/天气是 procedural
- **历史 epoch 是一等公民**——不只是 skin，是 geography/POI/route 都换的完整时间切片
- **浏览器端**——所有约束（包大小、内存、shader 复杂度）按 WebGL 走，不是 console-grade

## 当前位置 (2026-05-11)

```
✅ S1  Baseline regression gate
✅ S2  TS/Test hygiene
✅ CL  Debt + Tang anachronism cleanup
✅ SSOT codex round 5 audit (5 fixed, 5 deferred to S3-S5)
─────────────────────────────────────────────
⏳ S3  SurfaceProvider + DistanceBand        ← 下一步
⏳ S4  Epoch Schema v3
⏳ S5  Runtime Split
⏳ S6  Hero Visual Slice
```

总成本估算：~13-22 天工程（codex × Claude × BotW 对齐版）。

## 验证命令

```bash
npm install
npm run build:dem            # 首次必跑：生成秦岭切片资产
npm run dev                  # vite dev server

# 测试
npm run test:fast            # ~200ms 契约+数学
npm run regression:baseline  # S1 19 cases
npm test                     # 4-stage 全量 (~38s)
npm run build                # tsc + vite build (production)
```

## 参考

- [docs/README.md](./docs/README.md) — 文档导航
- [docs/context-summary.md](./docs/context-summary.md) — 当前状态一页
- [todo.md](./todo.md) — S1-S6 任务清单
- [docs/tang-epoch-755-poi-database.md](./docs/tang-epoch-755-poi-database.md) — Tang epoch v0 数据
