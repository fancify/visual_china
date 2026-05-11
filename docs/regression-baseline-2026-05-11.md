# S1 Baseline Regression Gate — 首次快照

**日期**: 2026-05-11
**Branch**: feature/full-china-1800m-hydrosheds
**Commit**: 待 commit
**Runner**: `npm run regression:baseline`

## 结果摘要

```
✔ tests:    19
✔ pass:     19
✔ fail:     0
  duration: 131ms
```

**19/19 全绿 = 当前 codebase 所有契约都被冻结成快照**。这不代表"没有 bug"，
代表"我们对将来 S2-S6 改动有一把客观尺子"。

## Case 清单 & 锁定的契约

| ID | 分类 | 测的契约 |
|---|---|---|
| **P1** | 玩家 | 平地脚踩地面（offset = +0.03，main.ts:887）|
| **P2** | 玩家 | 斜坡用 `groundSurface` 而不是 `ground`（P0 audit 核心修复）|
| **P3** | 玩家 | 上坡 y 平滑，max d²y/dt² < 1.0 |
| **P4** | 玩家 | 飞行 mount 用绝对 cloudFlightAltitude，忽略 ground |
| **C1** | 相机 | follow 模式 camera 抬过前景山（terrain-occlusion lift bug R10a）|
| **C2** | 相机 | overview 模式 target 等于 player x/z |
| **C3** | 相机 | follow 低 pitch (elevation=0.05) 相机不入地 |
| **W1** | 水 | 高视角看河，camera→river 几何无 terrain 遮挡 |
| **W2** | 水 | 沿河走廊低视角看河，岸不挡 |
| **W3** | 水 | 湖中心 anchor 到 sampler 高度 + 0.08 offset，不浮空 |
| **T1** | LOD | CompositeTerrainSampler 跨 chunk 边界无 NaN/巨变 |
| **T2** | LOD | `sampleHeightLod(x,z,1)` 用 `lodHeights.L1` 数据 |
| **T3** | LOD | 4 个 LOD 等级都返回 finite 值（圆形边界数据完整）|
| **S1** | 草木 | 草根 = `sampleSurfaceHeight`（mesh-aligned），不是 `sampleHeight`（bilinear）|
| **S2** | POI | `sampleSurfaceHeight` / `sampleHeight` 都应用 `TERRAIN_VERTICAL_EXAGGERATION = 1.07` |
| **E1** | 环境 | 太阳方向 24h 内连续旋转，相邻 sample dot > 0.95 |
| **E2** | 环境 | 晴→雨 weather lerp t 单调递增，最终落到 "rain" |
| **E3** | 环境 | 天体地平线 fade 在 altitude ∈ [-0.14, -0.04] smoothstep |
| **Z1** | 比例尺 | 西安↔洛阳几何距离 ≈ 3.27 km/世界单位（验证 codex 假设）|

## 这把尺子捕获什么 / 不捕获什么

### ✅ 捕获

- 任何模块改了 `+0.03` foot offset 但忘了同步全部 → **P1/P2 红**
- S5 拆分 main.ts 时不小心改了 camera 公式 → **C1/C2/C3 红**
- S3 引入 SurfaceProvider 时新接口不接 `sampleSurfaceHeight` mesh-aligned 契约 → **S1 红**
- 任何改变 `TERRAIN_VERTICAL_EXAGGERATION` 但没同步 sampler 和 mesh 的 → **S2 红**
- weather/sun/season 算法被改成离散步进而不是连续 lerp → **E1/E2 红**
- 投影常量被改 → **Z1 红**

### ❌ 不捕获（设计限制）

- **Render-order / polygonOffset 类纯 GPU bug**——例如河 ribbon 在某些视角因
  深度排序被 terrain pixel 盖住。这需要 Playwright + pixel diff，留给 S6 Hero
  slice 阶段。当前 baseline 只能保证*几何可见性*（camera→river 沿线无 terrain
  遮挡），不保证*像素可见性*。
- **真实 DEM 坐标特定的 bug**——例如"长安(108.95, 34.27)处 y 应该是 X 米"。
  当前用合成 DEM，不依赖 build:dem 产物。S3 SurfaceProvider 落地时如需可加
  data-bound case。
- **运行时帧率/性能问题**——baseline 是 contract 测试，跑 130ms，不测 FPS。
  现有的 `perf-monitor.test.mjs` 处理这部分。
- **音频内容质量、视觉美学**——主观体验类，不在 numeric baseline 范围。

## 已知 bug（baseline 未捕获但已知存在）

来源：最近 commit + todo.md 用户新增需求。这些是 S3-S6 的修复对象，
不是 S1 责任：

1. **河 ribbon 高视角因 polygonOffset 排序消失**（todo.md 用户第二轮）—— 几何
   可见但渲染消失。需要 Playwright 验证。
2. **城市建筑造型 "丑"，base+roof 两层**（todo.md 用户第二轮）—— 美学问题。
3. **LOD/距离淡入分层不统一**（todo.md 用户第二轮）—— S3 DistanceBand 处理。
4. **POI 位置准确性审计未做**（todo.md "暂缓"）—— S4 epoch schema 落地时验证。

## 用法

```bash
# 只跑 baseline
npm run regression:baseline

# 跟全量 test 一起跑（已加入 npm test 列表）
npm test
```

每次 S2-S6 commit 前应跑 baseline，红了说明触碰了已锁定的契约。

## 升级路径

| Step | baseline 演化 |
|---|---|
| S2 TS hygiene | 不动 baseline（无契约变化）|
| S3 SurfaceProvider | 把 P1-P2 snapshot 改成从 SurfaceProvider 真函数 import；新增 SurfaceState case |
| S4 Epoch Schema | 加 epoch-aware case：切换 epoch 时 contract 仍 ok |
| S5 Runtime Split | 把 main.ts snapshot 替换成真 runtime import |
| S6 Hero Slice | 加 Playwright 5 个视觉 sanity case（W1 polygonOffset 等）|
