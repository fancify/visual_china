# 千里江山图 · 性能基线（2026-05-02）

记录当前秦岭切片在不同场景下的 fps / ms / draw-calls / tris 基线，标记热路径，
列出排除/不排除的优化建议——给后续扩区 + Phase 1.5 视觉升级前做参照。

测试环境：Mac M-series（Vite dev mode），1200×765 视口，浏览器 Chrome。

---

## 1. 实测样本

| 场景 | fps | ms/frame | draw calls | tris | geom | 备注 |
|---|---|---|---|---|---|---|
| **默认相机（cameraDistance ≈ 65, follow）** | 120 | 0.39 | 70 | 107k | 46 | 稳定，cap 上限 |
| **overview（cameraDistance ≈ 170）** | 47-50 | 12-13 | 58-60 | 105k | 47 | 周期性掉帧 |
| **overview，不动相机** | **120 ↔ 48 交替**（每 ~150ms） | 0.4 ↔ 12 | 58 | 105k | 47 | **关键现象** |
| **atlas fullscreen（M）** | 47-50 | 12-13 | 71 | 107k | 47 | 持续 |
| **atlas fullscreen + zoom in** | 50 | 13 | 71 | 同上 | 同上 | 持续 |

> ⚠️ Vite dev 模式下 fps 比生产 build 略低，但相对差距可信。

---

## 2. 关键发现：HUD mini-map 周期性掉帧

`refreshHud()` 每 **0.15s** 触发一次（`hudRefreshTimer >= 0.15`），调用
`drawOverviewMap` → `drawAtlasMapCanvas`。该函数：

1. `drawAtlasBaseMap` — 把 cached imageData 用 `drawImage` 缩放贴到 mini-map
2. `drawDemQualityOverlay` — 标记缺 tile 区域
3. `atlasVisibleFeatures(features, layers, options)` — 过滤 + 排序 ~52 个 feature
4. `forEach` 画每个 feature（line / point / area）
5. `drawRegionPlacemarks` — 画 7 个 landform 标签
6. `drawAtlasOverlay` — 画 player position + 边框

总成本约 12ms。在默认 follow 相机下 fps 因 frame budget 可吸收，看起来还是 120；
overview 模式下 GPU 已经接近 frame budget 上限，HUD 那 12ms 就把 fps 砸下去。

---

## 3. 静态成本预算（每帧基础）

| 模块 | 估算 ms | 备注 |
|---|---|---|
| Terrain mesh （chunk 全开） | 2-3 | 主要 GPU bound |
| Sky shader + 5000 stars | 0.4 | 白天 stars 隐藏 |
| Cloud sprites（7 个） | 0.1 | 共享 material |
| InstancedMesh 树 / 灌木（~600） | 0.3 | 单 draw call |
| InstancedMesh city walls（28 城） | 0.4 | 3 tier 三个 InstancedMesh |
| Sprite labels（~30 个） + occlusion raycast（240 sampleHeight/帧） | 0.6 | software occlusion |
| 河流 ribbon（8 条 + 密化） | 0.3 | mesh + label |
| 名胜 + 考古 mesh（~30 件） | 0.2 | 单独 group |
| 玩家 avatar + 腿动画 | 0.1 | sin/cos 4 leg |
| **HUD mini-map redraw（每 0.15s）** | **~12** | **🔥 热路径 1** |
| 雨/雪 240 粒子（仅雨/雪天） | 0.15 | 平时跳过 |

---

## 4. 已优化项（前期 commits）

| 优化 | 预期收益 | commit |
|---|---|---|
| pixelRatio 1.5 → 1.25 | ~10% fps | 8e3e289 |
| 白天 starDome.visible = false | 省 5000 顶点 | 8e3e289 |
| Sprite material 共享（云/雨）| 省 6 个 material 实例 | 早期 |
| city panel: backdrop-filter 18px → solid bg | fps 8 → 33 修复 | 0aef4e0 |
| chunkVisible filter 跳过远处地标 | 减 ~30 mesh draw call | 062c63c |
| LOD fade（树/城/关隘/名胜/考古） | 减远距 mesh | 多次 |

---

## 5. 待做优化（按 cost-perf 比排序）

### 5.1 立即可做（≤ 0.5h，预期 +20-30 fps @ overview）

1. **HUD mini-map 节流到 0.5s**——0.15s 太密，玩家不会盯着小地图实时看。
   `hudRefreshTimer >= 0.5` 即可。预期 overview fps 从 47 → 80+。
2. **mini-map 渲染分阶段**——基础底图（base map cached + drawImage）跟 features
   绘制分开。features 只在 atlasFeatures changed 或 player 动了 X 像素后才重绘。
3. **`atlasVisibleFeatures` 结果按层缓存**——layers 不变 / features 不变时直接复用上次结果。

### 5.2 中等成本（1-2h）

4. **Frustum culling** for instanced city walls — 现在 28 城全程绘制。
   配合 LOD 已经隐去 county/prefecture，但 instance 实例数全部在 GPU 端。
   可以按 visibleChunkIds 把 instance 矩阵置零（`InstancedMesh.setMatrixAt(i, zeroMatrix)`）。
5. **Tree InstancedMesh 按 chunk 分组**——目前所有树同一个 InstancedMesh。
   按 chunk 拆开，可在 chunkVisible 处直接 `mesh.visible = false` 跳过整组。
6. **River ribbon 远距简化**——overview 距离 `> 170` 时把 polyline 段数减半，
   tris 从 ~3000 → ~1500。

### 5.3 大改造（3+h，留到 Phase 1.5）

7. **Atlas mini-map 用 WebGL 而不是 Canvas2D**——把高程贴图当 texture，
   sky shader 同款思路。预期 mini-map redraw 从 12ms → 0.5ms。
8. **Tree imposter 远距**——> 140 unit 距离换成 single quad with baked tree
   texture，instance count 不变但 tris 大幅减。

### ⛔ 不建议

- **DOF / Bloom heavy**：Phase 1.5 视觉升级用 UnrealBloomPass 即可，不要堆复杂效果。
- **动态 shadow map**：成本高、相对收益低，3D 模型已经 flat shading 风格。

---

## 6. 性能预算（Phase 4-5 扩区前要遵守的红线）

扩区可能新增 ~3x 数据（关中东扩 + 四川南扩）：

- 城市：28 → 60+
- 名胜：7 → 15+
- 考古：3 → 8+
- 河流：8 → 14+
- DEM tris（更多 chunk visible）：107k → ~140k

**红线**：
- 默认 follow 相机 fps **≥ 60**（生产 build），≥ 100（dev）
- overview 相机 fps **≥ 30**（生产），≥ 50（dev）
- atlas fullscreen redraw frame ms **≤ 8**（不卡 60fps）
- 内存 < 350 MB（heap + GPU）

**触发措施**：
- 一旦 fps 跌破红线，必须优先做 5.1 的 HUD 节流
- 扩区 chunk 数 > 50 时启用 chunk-LOD 三级（远 imposter / 中 simplified / 近 full）
- 单 region tris 总量 > 200k 时启用 frustum culling 对 instanced mesh

---

## 7. 立即可做（这个 PR 顺手做）

把 HUD mini-map 节流到 0.5s，单点小改动，预期收益最大。下面执行 + 重测。
