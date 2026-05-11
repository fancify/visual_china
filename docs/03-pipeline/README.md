---
type: moc
status: current
tags: [pipeline, ingestion, dem]
updated: 2026-05-12
---

# 03 — 数据 ingestion + 资产格式

DEM 烤制、HydroSHEDS 转换、atlas 派生、binary 格式规范。

## 文档

| 文档 | 类型 | 内容 |
|---|---|---|
| [china-national-dem](./china-national-dem.md) | spec | 全中国 DEM 母版方案 |
| [dem-asset-format-and-boundary-spec](./dem-asset-format-and-boundary-spec.md) | spec | DEM 资产格式 + 地理边界规范（619 行 ✦ 大文档） |
| [qinling-2d-atlas-pipeline](./qinling-2d-atlas-pipeline.md) | spec | 秦岭 2D atlas 派生流程 |

## 相关 scripts（项目根）

- `scripts/build-china-national-dem.mjs` — 全国 DEM 烤
- `scripts/download-china-fabdem.mjs` — FABDEM tile 下载
- `scripts/build-china-lowres-dem.mjs` — L0 低分辨率底
- `scripts/build-qinling-real-dem.mjs` — qinling region DEM 派生
- `scripts/build-qinling-*-hydrography*.mjs` — HydroSHEDS / OSM 水系

## 关联

- 上级 → [../README.md](../README.md)
- 架构方案 → [../02-architecture/](../02-architecture/)
- 当前重写 → [../02-architecture/terrain-rewrite-plan.md](../02-architecture/terrain-rewrite-plan.md) 会取代部分本目录内容
