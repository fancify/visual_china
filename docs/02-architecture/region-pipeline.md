---
type: plan
status: reference
tags: [architecture, design]
updated: 2026-05-12
---

# 长安三万里 · 区域流水线（Region Pipeline）

把"加一个新区域"这件事拆成可重复执行的步骤。本文档基于 秦岭-关中-四川盆地 切片
（`region.id = qinling`，bounds 103.5..109°E, 30.4..35.4°N）总结而成；后续要做的
**关中东扩 / 四川南扩** 沿用这套流程。

---

## 0. 名词

| 术语 | 含义 | 文件示例 |
|---|---|---|
| **region / slice** | 一个连续的 lat/lon 矩形覆盖的"母版"——切片 | `qinling`, `china-lowres` |
| **bounds** | `{ west, east, south, north }`（°），region 的地理覆盖范围 | `QINLING_BOUNDS` |
| **world** | `{ width, depth }` 单位 = 游戏世界单位（米类似），region 投影到的画布尺寸 | `QINLING_WORLD = { width:180, depth:240 }` |
| **DEM asset** | 经处理的高程网格 + 元信息，runtime 用作地形 + atlas 底色 | `public/data/qinling-slice-dem.json` |
| **chunk** | DEM 被切成的可流式加载子区，运行期按相机距离决定 visible | `public/data/regions/qinling/chunks/qinling_*_*.json` |
| **atlas feature** | 地图叙事单元（city/water/pass/scenic/ancient/livelihood），同时用于 atlas 2D + 3D mesh | `qinlingAtlasFeatures` |

---

## 1. 准备阶段（确定边界 + 配名）

1. **画 bounds**：用 web GIS / Wikipedia 找到要覆盖的 区域 lat/lon 极值，加约 0.2°
   缓冲以避免边界 POI 被裁。记录到一个 `region.config.ts`（或类似）：
   ```ts
   const REGION_BOUNDS = { west: 103.5, east: 109, south: 30.4, north: 35.4 };
   ```
2. **决定 world 尺寸**：保持每°经度 ~180/(east-west)、每°纬度 ~240/(north-south)
   的像素密度，避免画面失真。秦岭：5.5°×5°→180×240。
3. **取 region.id**：小写英文短名（`qinling`, `chuanxi`, `shanxi`）；不要含空格
   或特殊字符（chunk 文件名会拼这个）。
4. **决定 era**（朝代）：当前都是 `modern`。等做朝代切换时这里会扩。

---

## 2. DEM 流水线

### 2.1 下载 FABDEM 瓦片

FABDEM 全球 1 弧秒（30 m）DEM。每个瓦片 `S{lat}E{lon}_FABDEM_V1-2.tif` 覆盖 1°×1°。

```bash
npm run qinling:fabdem:download
# 自定义区：复制 scripts/download-qinling-fabdem.mjs，把 bounds 改成新区域
```

> ⚠️ FABDEM 用 ColorMap 压缩，要 `qinling:fabdem:extract` 先解出 GeoTIFF 数据。

### 2.2 跑 DEM 构建

```bash
npm run qinling:dem:build-real
# 等价于
node scripts/build-qinling-real-dem.mjs            # 把 tile → slice JSON
node scripts/build-qinling-region-assets.mjs       # slice → chunks + manifest
```

输出：
- `public/data/qinling-slice-dem.json` — 整切片高程矩阵 + 元信息
- `public/data/regions/qinling/manifest.json` — chunk 索引
- `public/data/regions/qinling/chunks/qinling_<col>_<row>.json` — chunk 高程

新区域：复制脚本 `build-qinling-real-dem.mjs` → `build-<id>-real-dem.mjs`，
改 bounds、输出路径、tile 列表。

### 2.3 验证

```bash
npm run verify:dem
# 检查：网格行列数一致 / 缺 tile 是否被插值标记 / minHeight maxHeight 合理
```

---

## 3. 投影约定

`src/game/mapOrientation.js`：**北 = -Z，东 = +X**（跟 Three.js camera 默认朝向对齐）。
任何 lat/lon → world 投影统一走 `projectGeoToWorld(point, bounds, world)`。新增
区域不要重新发明投影——直接复用。

Atlas pixel 投影同样走 `projectWorldToAtlasPixel`。

---

## 4. Atlas 数据结构

每个区域要至少提供：

```js
// src/game/<region>Atlas.js
export const <region>AtlasLayers = [
  { id: "water", name: "水系", defaultVisible: true, ... },
  { id: "city", name: "城市", defaultVisible: true, ... },
  { id: "pass", name: "关隘", defaultVisible: true, ... },
  { id: "scenic", name: "名胜", defaultVisible: true, ... },
  { id: "ancient", name: "考古", defaultVisible: true, ... },
  { id: "livelihood", name: "民生", defaultVisible: false, ... }
];

export const <region>AtlasFeatures = [
  ...modernHydrographyFeatures,           // 水系，从 hydrography.js 来
  ...realCityFeatures,                    // 城市，从 realCities.js 来（external-vector）
  ...passFeatures,                        // 关隘（manual draft）
  ...scenicLandmarkFeatures,              // 名胜（external-vector）
  ...ancientSiteFeatures,                 // 考古（external-vector）
  ...livelihoodFeatures                   // 民生（external-vector）
];
```

**source 约定**：
- `verification: "external-vector"` — 真实坐标，atlas 默认显示
- `verification: "unverified"` — 手画 draft，默认隐藏，需 toggle
- `confidence: high/medium/low` — 数据可信度（用于排序 / 过滤）

**displayPriority**：
- 10 = 主流（capital city / major river）
- 9 = 次主流（prefecture / scenic landmark）
- 8 = 支线（primary tributary / pass）
- ≤ 7 = 详细（OSM 加载后才显示）

---

## 5. 内容资产清单

| 类型 | 文件 | 必需 | 备注 |
|---|---|---|---|
| 水系 | `<region>Hydrography.js` + `public/data/regions/<id>/hydrography/modern.json` | 是 | 5+ 主干河流 polyline |
| 城市 | `realCities.js` 中过滤 lat/lon 在 bounds | 是 | capital + prefecture + 几个 county |
| 关隘 | atlas 文件 inline | 否 | 有就放 |
| 名胜 | `<region>ScenicLandmarks` | 是 | 5+ 真实景点 |
| 考古 | `<region>AncientSites` | 是 | 至少 1-2 个 |
| Story beats | `<region>StoryBeats` | 否 | 主线推进点 |
| Knowledge fragments | `<region>Fragments` | 否 | 拾取式叙事道具 |

**内容深度**：每个 city / scenic / ancient 至少要有 1-2 句 summary（atlas 弹卡）+ 城市/景点要有 wiki 级 `description`（POI panel 详细页）。

---

## 6. 3D 渲染绑定

主要 group（`src/main.ts` 顶部）：

```ts
const landmarkGroup     // pass + 普通 landmark mesh
const scenicGroup        // 名胜 mesh（独立组合体）
const ancientGroup       // 考古 mesh
const cityMarkersGroup   // 城市 InstancedMesh（capital/prefecture/county）
const waterSystemGroup   // 河流 ribbon + label
const routeGroup         // 古道（暂未启用）
const fragmentGroup      // 拾取道具
const riverVegetationGroup // 沿岸 instanced trees / shrubs
```

对应 rebuild 函数（每次切区时跑一次）：

```ts
rebuildLandmarkVisuals();     // pass
rebuildScenicVisuals();       // 名胜
rebuildAncientVisuals();      // 考古
rebuildFragmentVisuals();     // 拾取道具
// + 在 applyTerrainFromSampler 时跑：
rebuildWaterSystemVisuals();
rebuildRouteVisuals();
rebuildRiverVegetationVisuals(rivers);
applyTerrainFromSampler(sampler);  // 重贴所有 mesh 高度
```

**新 POI 类型加 mesh**：
1. 在 `<group>Geometries` 加 geometry
2. 在 `<group>Materials` 加 material
3. 在 `rebuild<Group>Visuals` 的 role-switch 加分支
4. 给 label 留 `terrainYOffset` 让 `applyTerrainFromSampler` 重贴高度
5. 在 `updateCityLodFade` 把 label sprite 加进 LOD 数组（距离淡出）+
   遮挡 occlude 列表（山体遮挡）

---

## 7. LOD + 性能预算

| 距离档 | 默认行为 | 适用 |
|---|---|---|
| 26..70 | 全显（含 county 名签） | 玩家近景 |
| 70..140 | county 名签淡出 | 普通巡游 |
| 140..170 | tree 淡出 | 拉远观察 |
| 170..240 | prefecture / pass / river / scenic / ancient 淡出 | overview |
| 240..330 | capital wall + 全部 mesh 淡出（防御层） | fly mode / extreme zoom-out |

实现：`updateCityLodFade()` 每帧跑一次；用 `MathUtils.smoothstep` 做平滑过渡，不
用 snap。新加的 group 要把 material.opacity + .visible 一起改（material.opacity=0 时
GPU 仍 draw call，所以 visible=false 才能完全省）。

---

## 8. 测试覆盖

新区域必须有的测试（参照 `scripts/qinling-*.test.mjs`）：

1. **`<region>-atlas-coverage.test.mjs`** — `qinlingAtlasRequiredNames` 中每个名
   字都能在 features 里找到
2. **`<region>-hydrography-asset.test.mjs`** — runtime 跟 public JSON 镜像一致
3. **`<region>-poi-geography.test.mjs`** — 所有 POI lat/lon 在 bounds 内
4. **`<region>-chunk-seams.test.mjs`** — chunk 边界高程连续，不裂
5. **`atlas-render-policy.test.mjs`** — 默认显示策略不破坏 verified-vs-unverified
   过滤

---

## 9. Checklist · 加新区域时按这个顺序走

```
[ ] 1.  确定 bounds + region.id + world 尺寸
[ ] 2.  下载 + 解压 FABDEM tile
[ ] 3.  写 build-<id>-real-dem.mjs
[ ] 4.  跑 npm run <id>:dem:build-real，verify 通过
[ ] 5.  写 src/game/<region>Atlas.js（layers + features 骨架）
[ ] 6.  写 <region>Hydrography.js + 镜像 public JSON
[ ] 7.  realCities.js 过滤本区 city（bounds 内）
[ ] 8.  scenicLandmarks + ancientSites 列出 5+ 个真实景点
[ ] 9.  3D mesh：在 main.ts 加 geometry/material/rebuild 函数 + 接入 init flow
[ ] 10. LOD：把新 label 加进 updateCityLodFade 的 fade + occlude 数组
[ ] 11. content：city wiki 级 description + scenic/ancient summary
[ ] 12. tests：复制 qinling 测试模板改成新 region
[ ] 13. atlas pixel rendering：检查 atlas overview 显示无错位
[ ] 14. 性能：FPS @ overview 应 ≥ 60，移动端 ≥ 30
[ ] 15. codex review 一遍
[ ] 16. commit + push
```

---

## 10. 已踩过的坑

| 坑 | 怎么避 | 记录于 |
|---|---|---|
| atlas / 3D 信息对不上 | atlas 跟 3D 共用 realCities + modernHydrography 同一份数据 | commit 3dbdd04 |
| labels 看不见（depthTest 故障） | Three.js Sprite + transparent + depthTest 实测整体不渲染；改 software raycast 占用极低 | commit 9bfdde1 |
| stele 三件套被 applyTerrainFromSampler 压平 | 每件 mesh 自己存 `terrainYOffset` 不被一刀切 | codex 9332266 |
| capital 城市永远不淡出 | 加远距离 fade（250..330）+ farMeshAlpha 给所有 mesh 共用 | commit bb82706 |
| 支流 rank-2 没 vegetation | `buildRiverVegetationSamples` 也要透传 minDisplayPriority | codex review of 3dbdd04 |

---

更新日期：2026-05-02 · 维护：随每次新区域上线时同步更新本文档
