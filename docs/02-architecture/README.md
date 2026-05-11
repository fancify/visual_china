---
type: moc
status: current
tags: [architecture, plan]
updated: 2026-05-12
---

# 02 — 架构 + 重大计划

系统设计、跨 module 决策、当前在做的大改造。

## 当前主线

| 文档 | 状态 | 内容 |
|---|---|---|
| [terrain-rewrite-plan](./terrain-rewrite-plan.md) | wip ⏳ | **当前主线** — 地形渲染单源 FABDEM + 多 LOD pyramid + ocean mask + 河水 shader 重写。8-9 天 |

## 架构基础（投影、流式、region）

| 文档 | 类型 | 内容 |
|---|---|---|
| [open-world-geographic-streaming-plan](./open-world-geographic-streaming-plan.md) | plan | chunk 流式加载方案 |
| [region-pipeline](./region-pipeline.md) | spec | region → chunk manifest → POI 体系 |
| [qinling-slice-design](./qinling-slice-design.md) | decision | 首个垂直切片为何选秦岭-关中-汉中-蜀道 |
| [geographic-coordinate-and-experience-compression](./geographic-coordinate-and-experience-compression.md) | spec | 严格地理坐标 vs 体验压缩规则 |

## 尺度 + 投影规则

| 文档 | 内容 |
|---|---|
| [slice-map-sizing-rules](./slice-map-sizing-rules.md) | 切片地图尺寸设计规则 |
| [world-to-slice-scaling-rules](./world-to-slice-scaling-rules.md) | 全国地图 ↔ 重点切片比例 |
| [national-density-and-compression-rules](./national-density-and-compression-rules.md) | 全国区域密度与压缩分级 |

## 关联

- 上级 → [../README.md](../README.md)
- 数据落地 → [../03-pipeline/](../03-pipeline/)
- 渲染映射 → [../04-rendering/](../04-rendering/)
