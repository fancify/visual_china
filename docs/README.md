# 山河中国文档入口

更新时间：2026-05-11

## 当前状态（2026-05-11）

- **Branch**: `feature/full-china-1800m-hydrosheds`
- **范围**: 全中国 73-135°E × 18-53°N（1711 × 1186 world units, ~3.27 km/u）
- **第一个 epoch**: 唐玄宗 天宝十四年 (755 AD) — 现代 DEM + 唐代水系/城市/POI overlay。详见 [memory/project_epoch_decision](../../.claude/projects/-Users-chen-Documents-GitHub-visual-china/memory/project_epoch_decision.md)
- **进行中**: 6-step refactor plan (Claude × Codex × BotW aligned)
  - S1 ✅ Baseline regression gate（19 cases，[报告](./regression-baseline-2026-05-11.md)）
  - S2 ✅ TS/Test hygiene（28 .d.ts → .ts canonical + .js shim, npm test 拆 4 组）
  - S3 ⏳ SurfaceProvider + DistanceBand（下一步，打穿模根因）
  - S4 ⏳ Epoch Schema v3
  - S5 ⏳ Runtime split (main.ts 6263 → 6 runtime)
  - S6 ⏳ Hero visual slice（融合 BotW 技巧）

## 必读顺序

1. [上下文压缩摘要](./context-summary.md) — 一页读懂当前架构、已完成内容、下一步
2. [第一阶段产品需求定稿](./product-requirements.md) — 项目要做成什么
3. [秦岭切片设计](./qinling-slice-design.md) — 为什么首个垂直切片选秦岭-关中-汉中-蜀道
4. [秦岭切片 2D Atlas Pipeline](./qinling-2d-atlas-pipeline.md) — 二维 atlas 作为信息源 + 3D 投影
5. [Regression baseline 2026-05-11](./regression-baseline-2026-05-11.md) — S1 的客观尺子，19 case 锁定的契约

## 架构与工程文档

- [DEM 资产格式与地理边界规范](./dem-asset-format-and-boundary-spec.md)
- [Region pipeline](./region-pipeline.md) — region → chunk manifest → POI 体系
- [开放世界地理资产流式加载方案](./open-world-geographic-streaming-plan.md)
- [严格地理坐标与体验压缩规则](./geographic-coordinate-and-experience-compression.md)
- [视觉风格与性能预算原则](./visual-style-and-performance-budget.md) — Hero slice (S6) 的参考
- [多尺度地图与历史年代层实现计划](./superpowers/plans/2026-05-01-multiscale-map-era-layers.md)
- [现代水系数据管线设计](./superpowers/specs/2026-05-01-modern-hydrography-pipeline-design.md)

## 地图尺度与全国规划

- [切片地图尺寸设计规则](./slice-map-sizing-rules.md)
- [全国地图与重点切片比例设计规则](./world-to-slice-scaling-rules.md)
- [全国区域密度与压缩分级规则](./national-density-and-compression-rules.md)
- [全国中国 DEM 母版方案](./china-national-dem.md)

## 研究档（不作为执行计划）

- [BotW immersion learning roadmap](./botw-immersion-learning-roadmap.md) — BotW 技巧调研档案，状态项与当前实现不完全一致；S6 hero slice 时会精选执行

## 历史过程文档

已归档到 `.archive/docs/`（保留在 git history 中可恢复）：

- `botw-tier-roadmap-r3-revised.md`（已被 BotW immersion roadmap 取代）
- `next-phase-execution-plan.md`（旧阶段 phase 0/1/2 计划）
- `next-phase-plan.md`（旧阶段计划，已被 6-step plan 取代）
- `technical-plan.md`（仍把项目描述成 prototype，已脱节）
- `requirements-alignment.md`（旧"placeholder → real DEM"阶段内容）
- `performance-baseline.md`（2026-05-02 旧 baseline，已被 S1 baseline 替代）
