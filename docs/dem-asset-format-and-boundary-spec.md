# 山河中国 · DEM 资产格式与地理边界规范

## 1. 这份规范解决什么问题

前面的文档已经明确了几件事：

- 项目未来是开放世界方向
- 全国总图需要 lazy load
- 重点区域需要高精度展开
- 区域之间不应采用完全平均的比例

因此后续一定不能继续停留在：

- 单个 `qinling-slice-dem.json`
- 运行时一次性整张图加载
- 资产边界只靠代码默会

这份规范的目标，是正式定义：

- DEM 资产应该分成哪几层
- 每层必须记录哪些边界信息
- 如何描述现实边界、运行时尺寸和分辨率
- 全国母版、区域切片、chunk 和附加语义层如何协同

## 2. 核心结论

未来地理资产不应只有一种文件，而应当至少分成 4 层：

1. `全国母版层`
2. `区域切片层`
3. `区域 chunk 层`
4. `附加语义与叙事层`

也就是说：

`切片资产层是必须的，但切片资产不应再被理解为“永远只有一张整图 JSON”。`

## 3. 统一术语

## 3.1 现实边界 `bounds`

指资产覆盖的现实地理范围。

单位：

- 纬度 / 经度

结构要求：

- `west`
- `east`
- `south`
- `north`

用途：

- 定位真实地理覆盖范围
- 支持全国与区域关系映射
- 支持切片与 chunk 空间索引

## 3.2 运行时尺寸 `world`

指资产进入运行时后的抽象空间尺寸。

单位：

- `world units`

结构要求：

- `width`
- `depth`

用途：

- 决定运行时场景中的地形占地
- 决定相机、角色、路径和地标的坐标空间

## 3.3 分辨率 `grid`

指高程或 mask 的栅格分辨率。

结构要求：

- `columns`
- `rows`

用途：

- 决定采样精度
- 决定生成地形网格时的细度

## 3.4 区域标识 `regionId`

每个区域切片和相关 chunk 都必须有稳定的区域 ID。

例如：

- `china-mainland`
- `qinling`
- `zhongyuan`
- `hexi-corridor`

## 3.5 层级标识 `lod`

用于表示数据属于哪一个精度层级。

建议至少支持：

- `L0` 全国低精度骨架
- `L1` 区域中精度骨架
- `L2` 区域高精度 chunk

## 4. 必须区分的 4 类资产

## 4.1 全国母版资产

作用：

- 提供全国尺度的连续地形骨架
- 作为远景、总览和区域发现基础

特点：

- 低精度
- 常驻或准常驻
- 以连续性优先，不以局部细节优先

## 4.2 区域切片资产

作用：

- 表达某一重点区域的完整地貌逻辑
- 用于生成或组织更高精度内容

特点：

- 精度高于全国母版
- 叙事密度更高
- 可以独立作为重点区域入口

## 4.3 区域 chunk 资产

作用：

- 支持 lazy load
- 将重点区进一步拆分为按需加载的块

特点：

- 每块覆盖较小
- 可随玩家位置加载/卸载
- 同一地区会有多个 chunk

## 4.4 附加语义资产

作用：

- 承载不直接等同于高程的数据
- 服务于玩法、叙事和可读性

包括但不限于：

- river mask
- pass mask
- settlement mask
- corridor mask
- ridge emphasis
- POI
- narrative triggers

## 5. 全国母版资产规范

未来全国母版推荐采用单独 manifest + 数据文件的形式。

建议结构：

```text
public/data/world/china/
  manifest.json
  l0-terrain.json
```

### 5.1 `manifest.json` 必填字段

```json
{
  "id": "china-mainland",
  "type": "world-manifest",
  "version": 1,
  "sourceType": "FABDEM V1-2",
  "generatedAt": "2026-05-01T00:00:00.000Z",
  "bounds": {
    "west": 73,
    "east": 135,
    "south": 18,
    "north": 54
  },
  "world": {
    "width": 10.0,
    "depth": 7.5
  },
  "lods": [
    {
      "id": "L0",
      "file": "l0-terrain.json",
      "grid": {
        "columns": 576,
        "rows": 336
      }
    }
  ],
  "regions": [
    "qinling",
    "zhongyuan",
    "hexi-corridor"
  ]
}
```

### 5.2 全国母版数据文件要求

全国母版数据文件至少应包含：

- `id`
- `regionId`
- `lod`
- `bounds`
- `world`
- `grid`
- `minHeight`
- `maxHeight`
- `heights`

可选：

- `riverMask`
- `settlementMask`

不要求：

- 很高精度 pass / poi / narrative layers

## 6. 区域切片资产规范

每个重点区域都应有自己的目录。

建议结构：

```text
public/data/regions/qinling/
  manifest.json
  slice-l1.json
  chunks/
  poi/
```

### 6.1 区域 `manifest.json` 必填字段

```json
{
  "id": "qinling",
  "type": "region-manifest",
  "version": 1,
  "displayName": "秦岭 - 关中 - 汉中 - 四川盆地",
  "densityClass": "high-focus",
  "parentWorldId": "china-mainland",
  "bounds": {
    "west": 103.5,
    "east": 109.0,
    "south": 30.4,
    "north": 35.4
  },
  "world": {
    "width": 1.8,
    "depth": 2.4
  },
  "geographicFootprintKm": {
    "width": 420,
    "depth": 560
  },
  "experienceScaleMultiplier": 2.3,
  "lods": [
    {
      "id": "L1",
      "file": "slice-l1.json",
      "grid": {
        "columns": 256,
        "rows": 320
      }
    }
  ],
  "chunking": {
    "enabled": true,
    "chunkColumns": 4,
    "chunkRows": 5,
    "chunkManifest": "chunks/manifest.json"
  },
  "poiManifest": "poi/manifest.json"
}
```

### 6.2 区域切片必须记录的额外信息

区域切片相对全国母版，必须多记录：

- `densityClass`
- `geographicFootprintKm`
- `experienceScaleMultiplier`

原因：

- 这能明确说明该区域为什么被放大
- 也能避免运行时把 world size 误认为现实尺寸

## 7. 区域 chunk 资产规范

重点区域必须支持分块。

建议结构：

```text
public/data/regions/qinling/chunks/
  manifest.json
  qinling_0_0.json
  qinling_0_1.json
  ...
```

### 7.1 chunk manifest 必填字段

```json
{
  "regionId": "qinling",
  "type": "chunk-manifest",
  "version": 1,
  "schemaVersion": 1,
  "chunkColumns": 4,
  "chunkRows": 5,
  "chunks": [
    {
      "id": "qinling_0_0",
      "x": 0,
      "y": 0,
      "file": "qinling_0_0.json",
      "bounds": {
        "west": 103.5,
        "east": 104.875,
        "south": 34.4,
        "north": 35.4
      },
      "worldBounds": {
        "minX": -0.9,
        "maxX": -0.45,
        "minZ": 0.96,
        "maxZ": 1.2
      }
    }
  ]
}
```

### 7.2 单个 chunk 文件必填字段

```json
{
  "id": "qinling_0_0",
  "type": "terrain-chunk",
  "version": 1,
  "schemaVersion": 1,
  "regionId": "qinling",
  "lod": "L2",
  "bounds": {
    "west": 103.5,
    "east": 104.875,
    "south": 34.4,
    "north": 35.4
  },
  "worldBounds": {
    "minX": -0.9,
    "maxX": -0.45,
    "minZ": 0.96,
    "maxZ": 1.2
  },
  "grid": {
    "columns": 64,
    "rows": 64
  },
  "minHeight": 320.0,
  "maxHeight": 2580.0,
  "heights": [],
  "riverMask": [],
  "passMask": [],
  "settlementMask": []
}
```

### 7.3 chunk asset schema v2 预留契约

Phase 0-6 会同时改动 chunk build pipeline。为避免雕河、城市压平、AO、biome 与 LOD height texture 各自发明字段，chunk asset 从下一轮管线改造开始统一使用 `schemaVersion: 2`。当前运行时仍只要求 v1 字段；本节只定义 v2 契约，不要求本轮实现写入或读取。

v2 单个 chunk 文件在 v1 基础上增加以下字段：

```ts
{
  schemaVersion: 2,
  heights: Float32Array, // existing
  waterMask?: Uint8Array,
  cityFlattened?: {
    footprintList: Array<{
      id: string;
      baseHeight: number;
      polygon: Array<{ x: number; z: number }>;
    }>;
  },
  vertexAo?: Uint8Array,
  biomeId?: string,
  speciesRecipe?: {
    trees: Array<{ species: string; density: number }>;
    wildlife: Array<{ species: string; density: number }>;
  },
  seasonalRecipe?: {
    springColor: string;
    autumnDrop: number;
    winterSnowMask: Uint8Array;
  },
  lodHeights?: {
    L1: Float32Array;
    L2: Float32Array;
    L3: Float32Array;
  }
}
```

字段责任表：

| 字段 | 用途 | 写入脚本 | runtime 读取方式 |
|---|---|---|---|
| `schemaVersion` | 区分 chunk schema，避免 build pipeline 撞车 | 所有 chunk build script；v1 资产显式写 `1`，v2 管线写 `2` | `loadChunkAsset` / DEM loader 先检测版本；未知版本拒收或降级 |
| `heights` | 主高度场，维持现有 terrain mesh / sampler 契约 | `build-qinling-region-assets.mjs` 及后续全国/区域 chunk build | v1/v2 都按现有 `TerrainSampler` 读取；v2 不改变语义 |
| `waterMask` | Phase 1 雕河与贴地水面 mesh 的水域栅格 | Phase 1 hydrography carve build script | 缺失时默认全 0；水面生成只在 mask > threshold 时提取 |
| `cityFlattened.footprintList` | Phase 0 城市基底压平记录，描述哪些城市 footprint 已写进 heightmap | Phase 0 city anchor / flatten build script | 缺失时视为未压平；GroundAnchor / city renderer 回退现有采样逻辑 |
| `vertexAo` | Phase 2 顶点 AO 烘焙结果，供山谷和建筑接地阴影使用 | Phase 2 AO bake script | 缺失时默认 AO=255（无额外遮蔽）；terrain material 可作为 vertex alpha/attribute 读取 |
| `biomeId` | Phase 6 地域 biome 查找主键，控制植被、动物和季节色彩 | Phase 6 biome assignment build script | 缺失时按 region 默认 biome；scenery/wildlife 不因字段缺失崩溃 |
| `speciesRecipe` | Phase 6 分 chunk 树种与动物密度配方 | Phase 6 species recipe build script | 缺失时使用现有全局 scenery/wildlife recipe；density 按 chunk 面积归一 |
| `seasonalRecipe` | Phase 6 季节色、落叶比例、积雪 mask 配方 | Phase 6 seasonal bake script | 缺失时使用 EnvironmentController 的区域默认季节参数 |
| `lodHeights` | Phase 0 LOD geomorph 的 L1/L2/L3 高度源，供远景双级采样 | Phase 0 LOD height texture build script | 缺失时 runtime 只使用 `heights`，关闭该 chunk 的 geomorph 或用邻近 LOD 回退 |

向后兼容策略：

1. runtime 必须先读取 `schemaVersion`；字段缺失时按 `1` 处理，以兼容当前已生成的 v1 chunks。
2. v1 chunks 仍可加载，`waterMask / cityFlattened / vertexAo / biomeId / speciesRecipe / seasonalRecipe / lodHeights` 全部使用默认值。
3. v2 build scripts 可以逐步写入字段；runtime 不得假设 v2 的所有可选字段同时存在。
4. build pipeline 修改同一字段时必须更新本表的“写入脚本”和默认值说明，避免后续 phase 隐式改格式。

## 8. 附加语义层规范

附加语义层应与纯地形分开组织，不建议全部塞回同一个总文件。

建议分类：

- `terrain`
- `masks`
- `poi`
- `narrative`
- `scenery`

### 8.1 `masks` 建议字段

基础可保留：

- `riverMask`
- `passMask`
- `settlementMask`

未来可扩展：

- `corridorMask`
- `ridgeMask`
- `visibilityMask`
- `agricultureMask`

### 8.2 `poi` 资产建议字段

- `id`
- `regionId`
- `kind`
- `name`
- `worldPosition`
- `geoPosition`
- `importance`
- `lodVisibility`

### 8.3 `narrative` 资产建议字段

- `id`
- `regionId`
- `triggerShape`
- `worldBounds`
- `title`
- `modeTags`
- `contentRef`

## 9. `world` 与 `bounds` 的关系必须明确

这是未来最容易混掉的点。

必须明确：

- `bounds` 描述现实地理覆盖
- `world` 描述运行时抽象空间

两者不能互相替代。

也就是说，不允许：

- 只存 world，不存 bounds
- 只存 bounds，不存 world

因为：

- 没有 `bounds`，就不能和全国地理关系对齐
- 没有 `world`，运行时就无法稳定构建空间

## 10. 资产版本与来源信息必须存在

每个可运行 DEM 资产至少要记录：

- `version`
- `sourceType`
- `generatedAt`

建议记录：

- `sourceDatasetId`
- `generatorVersion`
- `notes`

原因：

- 后续真实 DEM 迭代时，必须能知道资产来自哪一轮处理

## 11. 当前推荐的统一最小字段集合

凡是“可被运行时直接消费的地形资产”，最少必须包含：

```json
{
  "id": "qinling",
  "type": "terrain-slice",
  "version": 1,
  "schemaVersion": 1,
  "regionId": "qinling",
  "lod": "L1",
  "sourceType": "processed-real-dem",
  "generatedAt": "2026-05-01T00:00:00.000Z",
  "bounds": {
    "west": 103.5,
    "east": 109.0,
    "south": 30.4,
    "north": 35.4
  },
  "world": {
    "width": 1.8,
    "depth": 2.4
  },
  "grid": {
    "columns": 256,
    "rows": 320
  },
  "minHeight": 0,
  "maxHeight": 3200,
  "heights": [],
  "riverMask": [],
  "passMask": [],
  "settlementMask": []
}
```

## 12. 运行时实现时必须遵守的规则

1. 运行时不得假设所有区域 world size 相同。
2. 运行时不得假设所有区域 grid 分辨率相同。
3. 运行时不得假设 `1 world unit = 固定多少公里`。
4. 运行时必须优先读取 asset 自带的 `bounds / world / grid`。
5. chunk 必须既能映射到现实边界，也能映射到运行时边界。
6. 附加语义层不得无限混进主地形文件，避免单文件臃肿。

## 13. 从当前原型迁移到这套结构的建议路径

### 13.1 第一步

先把当前单文件切片资产补齐字段：

- `id`
- `type`
- `version`
- `regionId`
- `lod`
- `bounds`

### 13.2 第二步

增加区域 manifest：

- 把 `qinling-slice-dem.json` 纳入 `regions/qinling/manifest.json`

### 13.3 第三步

增加 chunk manifest 与 chunk 资产结构，
即便第一版 chunk 数量不多，也先把接口建起来。

### 13.4 第四步

把 poi / fragments / landmarks 逐步改成按 region 或 chunk 组织。

## 14. 当前建议的一句话版

`未来 DEM 资产必须同时记录现实边界与运行时边界，并从“单文件整图”升级为“全国母版 + 区域切片 + chunk + 语义层”的分层结构；切片资产层本身是必须的，但它应当成为开放世界 lazy load 架构的一部分，而不是停留在原型阶段的一张 JSON。`
