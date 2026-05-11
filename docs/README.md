---
type: moc
status: current
tags: [index, overview]
updated: 2026-05-12
---

# 山河中国文档入口

> 本目录是 Obsidian vault 根。Obsidian 打开仓库根目录即可。

## 当前状态

- **Branch**: `feature/terrain-rewrite-v2`（地形渲染单源 FABDEM + 多 LOD pyramid 重写中）
- **范围**: 全中国 73-135°E × 18-53°N（1711 × 1186 world units, ~3.27 km/u）
- **第一个 epoch**: [唐玄宗 天宝十四年 (755)](./05-epoch/tang-epoch-755-poi-database.md) — 安史前夜
- **7-step refactor 进度**:
  - S1 ✅ Baseline ([regression](./04-rendering/regression-baseline-2026-05-11.md))
  - S2 ✅ TS hygiene
  - S3 ✅ SurfaceProvider SSOT (a + b)
  - S4a ✅ [EpochManifest schema](./02-architecture/terrain-rewrite-plan.md) shipped
  - S4b ⏸ Tang data sourcing（暂搁，等 terrain rewrite 完）
  - **terrain-rewrite-v2 ⏳ 当前主线**（解 6 个穿模 bug + multi-LOD + ocean mask + 河水 shader）
  - S5 ⏳ Runtime split
  - S6 ⏳ Hero visual slice

## 5 大分类

### 🎯 [01-product/](./01-product/) — 产品愿景 + 需求 + 路线图

要做成什么、为谁做、做到什么程度。

### 🏛 [02-architecture/](./02-architecture/) — 系统架构 + 重大计划

地形渲染重写计划、流式加载、坐标系/投影规则、region pipeline。

### 🔧 [03-pipeline/](./03-pipeline/) — 数据 ingestion + 资产格式

DEM 烤制、HydroSHEDS 转换、atlas 派生、binary 格式规范。

### 🎨 [04-rendering/](./04-rendering/) — 视觉 + 性能

视觉风格 / 性能预算 / 渲染基线 / regression 报告。

### 🏯 [05-epoch/](./05-epoch/) — 历史 epoch 数据

Tang 755 POI 数据库；将来 Han / Song / 元代等其他 epoch。

### 📦 [archive/](./archive/) — 已被取代的历史文档

旧 phase 计划、被 6-step plan 取代的内容、过时的 baseline。

## 必读顺序（新人 onboarding）

1. [01-product/context-summary](./01-product/context-summary.md) — 一页读懂当前架构 + 进度
2. [01-product/product-requirements](./01-product/product-requirements.md) — 项目目标
3. [02-architecture/terrain-rewrite-plan](./02-architecture/terrain-rewrite-plan.md) — **当前主线**
4. [02-architecture/qinling-slice-design](./02-architecture/qinling-slice-design.md) — 首个垂直切片为何选秦岭
5. [04-rendering/regression-baseline-2026-05-11](./04-rendering/regression-baseline-2026-05-11.md) — S1 锁的 19 case 契约

## 跨 Obsidian / GitHub 兼容性

- 所有 link 用 markdown `[text](./path.md)` 风格 —— Obsidian 和 GitHub 都正确显示
- 不用 `[[wikilink]]` —— GitHub 不识别
- frontmatter YAML —— Obsidian 用于 tag/status filter，GitHub 显示为普通代码块

## tag 索引

- `#dem` — DEM 数据、烤制、采样
- `#rendering` — terrain mesh、shader、material
- `#pipeline` — ingestion scripts、数据流
- `#tang-epoch` — 唐 755 相关
- `#performance` — 性能预算、profiling
- `#ssot` — Single Source of Truth 守护
- `#wip` — 当前在做
- `#shipped` — 已完成
- `#superseded` — 已被替代（archive）

## 相关外部资源

- [memory/](../.claude/projects/-Users-chen-Documents-GitHub-visual-china/memory/) — Claude 跨 session 记忆（feedback / project / reference）
- [todo.md](../todo.md) — 项目根 todo（最高 level 任务）
- [CLAUDE.md](../CLAUDE.md) — 项目协作规约（Claude 必读）
- [ARCHITECTURE.md](../ARCHITECTURE.md) — 系统架构（项目根）
