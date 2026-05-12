# 山河中国 · 开发 todo

更新时间：2026-05-12

并行三条线，Line A/B 各跑各的 worktree（详见 CLAUDE.md）：

- **Line A · 地形完善** → `/Users/chen/Documents/GitHub/visual_china` on `feature/terrain-rewrite-v2`
- **Line B · POI 制作** → `/Users/chen/Documents/GitHub/visual_china-poi` on `feat/tang-poi-database`
- **Line C · 游戏体验/视觉优化** → 暂缓，等 Line A 到 S6 Hero Slice 之后启

---

## Line A · 地形完善（7-Step Refactor + Pyramid）

详细 plan 见 [memory/project_refactor_plan_v1](../.claude/projects/-Users-chen-Documents-GitHub-visual-china/memory/project_refactor_plan_v1.md)。

### 已完成

- ✅ **S1 Baseline + Regression Gate** (0.5-1d)
  - 19 case 锁定契约，`npm run regression:baseline` 19/19 pass
  - 报告：[docs/regression-baseline-2026-05-11.md](./docs/regression-baseline-2026-05-11.md)
- ✅ **S2 TS / Test Hygiene** (0.5-1d)
  - 28 .d.ts → .ts canonical + .js shim；5 重复 dedupe
  - tsconfig 升 ES2023；`qinlingAtlas.ts` 有 `@ts-nocheck` (S5 修)
  - `npm test` 拆 fast/visual/audio/data 4 组
- ✅ **(2026-05-12 加塞)** Pyramid bake + render seam 全套修复
  - `60dd30740` chunkSizeDeg 1.024 → 1.0 (FABDEM tile align)
  - `5b17bbcb2` bakeL0 cell-center sampling
  - `92764af42` vertex-position sampling
  - `f7580cfc0` **pyramidMesh row flip true root cause** — 证据见 `docs/04-rendering/2026-05-12-chunk-row-flip-fix/`

### 进行中 / 下一步

- ⏳ **S3 SurfaceProvider + DistanceBand** (2-4d) — 下一步，直接打穿模根因
  - SurfaceProvider 接口：`sampleGround / sampleWater / classifyDistance`
  - SurfaceState：`material / wetness / snowCover / dust / waterDepth / reflectivity / traction / footstep`
  - DistanceBand policy：terrain 最后退，actors/植被/POI 先退；view-cone cull
  - **SSOT** (codex 5 审计 deferred)：`SurfaceProvider.sample()` 成为 `inWater / wet bank / grass footstep / river mask / road lift` 等判断的唯一入口；删 main.ts / waterSystemVisuals / audio/triggerSystem / scenery / plankRoadRenderer 里各自局部 heuristic
- ⏳ **S4 Epoch Schema v3** (2-4d)
  - EpochManifest：`worldId / regionId / epochId / projection / terrain / hydrography / settlements / routes / poi / visualProfile / sourceQuality`
  - LandmarkHierarchy (Triangle Rule)：`gravityWell / large / medium / small` + `visualForm / visibilityBand / revealRole`
  - 第一份实例：`epochs/tang-tianbao-14/manifest.json`
  - Tang 水系重做：黄河北流 / 济水 / 隋唐运河 / 淮河独流 / 桑干河
  - **SSOT** (codex 5 审计 deferred)：
    - RouteManifest 唯一源（删 routes / routeAnchors / routePaths 三处独立 author）
    - `docs/tang-epoch-755-poi-database.md` 数据迁到 `epochs/tang-tianbao-14/cities.json`，md 只留 research notes
    - City ID rename：`xian` → `changan` 等 30+；hardcoded test 引用一起改
    - Hydrography `RELATIONS_BY_ID` 改 typed registry 校验 city/route id
- ⏳ **S5 Runtime Split** (5-7d, 高风险 step)
  - main.ts 6263 → 6 runtime (Terrain / Surface / Water / Content / Environment / Player)
  - main.ts 留 boot + input wiring + frame scheduler
  - 加 AudioDirector（ambient bed + sparse music + stinger）
  - 固定 render layering: terrain→water→weather→content→player→post
  - 同时修 `qinlingAtlas.ts` ts-nocheck + `data/*.js` 类型补全
  - **SSOT** (codex 5 审计 deferred)：
    - MountDefinition 扩 `speedMultiplier / isFlying / inertia / audioProfile`（删 mounts / mountRuntime / playerCustomization / mount-speeds.test 各自副本）
    - RenderLayerPolicy 集中 `renderOrder / depthWrite / depthTest / polygonOffset`（删 main.ts + terrainMesh + cityMarkers + cloudPlanes + waterSurfaceShader + castShadowPolicy 六处散落）
- ⏳ **S6 Hero Visual Slice** (3-7d)
  - 选一条唐风山水路线（建议长安-终南-子午谷 或 长安-潼关）
  - 1-2u 半宽 pilot → 扩到 3-5u
  - BotW 技巧融合：A2 fog inscatter + A4 VisualProfile + B1 草法线 + B2 树叶 edited normals + E3 snowCover + F5 context-triggered swell + G3 前景 silhouette foliage
- ⏳ **S7 Polish** — 收口

### Line A 已知问题（baseline 未捕获但 S3-S6 会处理）

1. **河 ribbon 高视角因 polygonOffset 排序消失** — S6 Playwright sanity 捕获
2. **城市建筑造型 "丑"，base+roof 两层** — 用户第二轮需求，S6 hero slice 重做
3. **LOD/距离淡入分层不统一** — S3 DistanceBand 处理
4. **POI 位置准确性审计未做** — S4 epoch schema 数据迁移时验证（与 Line B 协同）
5. **跨 chunk normal vector 不连续可能产生轻微光照接缝** — flip fix 后再观察，确认需要后做 ghost-vertex 共享 normal

---

## Line B · POI 制作

POI 制作 4 阶段，可并行/分阶段启动。当前在 Phase 1。

参考记忆：[project_tang_epoch_poi_spec](../.claude/projects/-Users-chen-Documents-GitHub-visual-china/memory/project_tang_epoch_poi_spec.md)、[project_tang_epoch_neighbors](../.claude/projects/-Users-chen-Documents-GitHub-visual-china/memory/project_tang_epoch_neighbors.md)、[feedback_tang_data_sourcing](../.claude/projects/-Users-chen-Documents-GitHub-visual-china/memory/feedback_tang_data_sourcing.md)。

### Phase 1 ⏳ POI 清单确认

- 现状：29 篇 docs 已写
  - `cities/` ×9 — 长安、洛阳、扬州、太原、益州、凉州、灵武、陕州、幽州
  - `relics/` ×6 — 白马寺、法门寺、龙门石窟、莫高窟、辋川别业、兴教寺
  - `scenic/` ×6 — 华山、庐山、嵩山、太白山、终南山、泰山
  - `transport/` ×8 — 蜀道八条（褒斜、陈仓、金牛、荔枝、米仓、岐山、傥骆、子午）
  - `POI-INVENTORY.md` 422 行
- **TODO**：audit vs `project_tang_epoch_neighbors`——周边文明覆盖度
  - 吐蕃 ✗（逻些、那曲、青海湖南岸）
  - 西域 ✗（焉耆、龟兹、于阗、疏勒、高昌、撒马尔罕、布哈拉）
  - 南诏 ✗（太和城）
  - 新罗 ✗（金城）
  - 渤海 ✗（上京龙泉府）
  - 回纥 ✗（牙帐）
  - 大食 ✗（呼罗珊、巴格达）
- 输出：POI-INVENTORY.md 更新 + Phase 2 写作排队

### Phase 2 ⏳ 文字介绍撰写

- 散文风格（参《万历十五年》），4 类一致 voice
- 每 POI：Tang 755 当下视角 + 历史长河
- 数据来源必须 verified（不许 LLM 推测历史地名/坐标——见 feedback_tang_data_sourcing）

### Phase 3 ⏳ 详细图文

- 配图、地图、考据照片
- 来源标注 + 版权
- 视觉风格统一（参考长安三万里 / 千里江山图色调）

### Phase 4 ⏳ 3D 模型

- POI 在 3D 场景中可走近的实体
- 依赖 Line A 的 S5 ContentRuntime + S6 Hero Slice 完成
- 优先级：长安 > 洛阳 > 嵩山 / 华山

---

## Line C · 游戏体验和视觉优化（暂缓）

待 Line A 推到 S6 Hero Visual Slice 之后启动。当前不立 task。

---

## 不做清单（codex × Claude × BotW 三轮对齐）

1. 不做"全中国近景 BotW 草海"——hero corridor 局部做
2. 不用 normal map 假装解决 DEM 精度
3. 不用更多 `yOffset/lerp` 继续补穿模（S3 SurfaceProvider 根治）
4. 不在现有 manifest 硬塞 `if epoch === ...`（S4 schema 解决）
5. 不把 hydrosheds 当海岸线数据
6. 不给 24 节气各做一套独立 shader/palette
7. 远景不再加载 POI/水/植被细节
8. 不做 FFT 风（sin 够）
9. 不做真体积云（billboard + cookie 够）
10. 不做物理大气全量散射（解析近似够）
11. 不做常驻 BGM（稀疏 piano fragment + ambient bed）
12. 不做 BotW chemistry engine（无战斗/食物系统）

---

## 历史归档

完整旧 todo（包含 P1-P7 视觉急救包、用户三轮新增需求、跨 phase 流程约定等）已归档到 [.archive/todo-2026-05-pre-s3-cleanup.md](./.archive/todo-2026-05-pre-s3-cleanup.md)。
