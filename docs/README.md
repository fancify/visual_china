# 山河中国文档入口

更新时间：2026-05-01

这份目录页用来解决一个问题：项目已经快速推进了一段时间，文档数量开始变多，后来者需要先知道“现在该读什么，不该从哪里开始”。

## 必读顺序

1. [上下文压缩摘要](./context-summary.md)  
   用一页读懂当前项目目标、架构状态、已完成内容、主要问题和下一步。

2. [第一阶段产品需求定稿](./product-requirements.md)  
   说明这个项目到底要做成什么：介于游戏和交互展览之间的开放式地理叙事体验。

3. [秦岭切片设计](./qinling-slice-design.md)  
   说明为什么首个垂直切片选秦岭-关中-汉中-四川盆地，以及它承担哪些产品验证任务。

4. [秦岭切片 2D Atlas Pipeline](./qinling-2d-atlas-pipeline.md)  
   当前最新架构方向：先把二维地貌总览图作为信息源，再把 POI、水系、路线和造型规则投到 3D。

5. [开发任务看板](./development-task-list.md)  
   当前完成度、待办优先级和验证命令。

6. [下一阶段计划](./next-phase-plan.md)  
   下一轮应该集中推进的开发路线。

7. [多尺度地图与历史年代层架构设计](./superpowers/specs/2026-05-01-multiscale-map-era-layers-design.md)
   说明当前秦岭地图如何作为总览层，未来如何通过入口进入局部场景，并预留历史年代 overlay。

## 架构与工程文档

- [首版技术方案](./technical-plan.md)
- [DEM 资产格式与地理边界规范](./dem-asset-format-and-boundary-spec.md)
- [开放世界地理资产流式加载方案](./open-world-geographic-streaming-plan.md)
- [严格地理坐标与体验压缩规则](./geographic-coordinate-and-experience-compression.md)
- [视觉风格与性能预算原则](./visual-style-and-performance-budget.md)
- [多尺度地图与历史年代层实现计划](./superpowers/plans/2026-05-01-multiscale-map-era-layers.md)
- [现代水系数据管线设计](./superpowers/specs/2026-05-01-modern-hydrography-pipeline-design.md)
- [现代水系数据管线实现计划](./superpowers/plans/2026-05-01-modern-hydrography-pipeline.md)

## 地图尺度与全国规划

- [切片地图尺寸设计规则](./slice-map-sizing-rules.md)
- [全国地图与重点切片比例设计规则](./world-to-slice-scaling-rules.md)
- [全国区域密度与压缩分级规则](./national-density-and-compression-rules.md)
- [全国中国 DEM 母版方案](./china-national-dem.md)

## 历史过程文档

这些文档记录了前期沟通和阶段性方案，有价值，但不是下一阶段工作的入口：

- [需求对齐与共识草案](./requirements-alignment.md)
- [下一阶段执行方案](./next-phase-execution-plan.md)
- [Superpowers 2D Atlas 设计记录](./superpowers/specs/2026-05-01-qinling-2d-atlas-design.md)
- [Superpowers 2D Atlas 实施计划](./superpowers/plans/2026-05-01-qinling-2d-atlas.md)
