# 山河中国开发任务看板

更新时间：2026-05-01

这份看板用于把当前开发从“边想边做”推进到“可持续执行”。默认目标是：真实秦岭 DEM 下载完成后，项目可以立刻进入高质量接入、验证和继续开发，而不是重新梳理上下文。

## 当前总目标

先把秦岭做成第一个标准区域样板：

- 支持 `region manifest -> LOD asset -> chunk manifest -> POI/story content`。
- 支持整区底图、近身 chunk terrain、轻量 scenery 与主线引导。
- 真实 FABDEM 已接入当前秦岭切片，并跑过数据校验与生产构建。
- 架构上继续为全国开放世界和 lazy load 做准备。

## P0 下载完成前必须就绪

| ID | 任务 | 状态 | 验收标准 |
| --- | --- | --- | --- |
| P0-1 | 秦岭区域 manifest 化 | 已完成 | 默认入口读取 `public/data/regions/qinling/manifest.json` |
| P0-2 | chunk manifest 与 20 个 chunk 资产生成 | 已完成 | `npm run verify:dem` 会校验 chunk manifest |
| P0-3 | region bundle loader | 已完成 | 运行时统一加载 terrain、chunk manifest、POI content |
| P0-4 | chunk terrain 激活与卸载窗口 | 已完成 | 玩家附近 chunk 显示，远离 chunk 会释放 |
| P0-5 | 主线叙事骨架 | 已完成 | HUD 显示 `1/6` 到 `6/6` 的区域主线推进 |
| P0-6 | 主线节点资产化 | 已完成 | `storyBeats` 存在于 POI content，验证脚本会检查引用 |
| P0-7 | 性能预算配置 | 已完成 | chunk 半径、保留半径、最大加载 chunk、scenery 数量可配置 |
| P0-8 | 轻量 scenery 占位层 | 已完成 | 树与聚落按 chunk 生命周期生成和释放 |
| P0-9 | 下载/资产状态检查工具 | 已完成 | `npm run qinling:dem:status` 能看到 zip、partial、tiles、当前 DEM source、region 状态 |
| P0-10 | 真实 DEM 脚本链路审查 | 已完成 | 明确下载完成后的命令顺序和高风险点 |

## P1 下载完成后立刻执行

| ID | 任务 | 状态 | 验收标准 |
| --- | --- | --- | --- |
| P1-1 | 解压秦岭 FABDEM archive | 已完成（有瓦片损坏） | `data/fabdem/qinling/tiles` 已有 97 个 `.tif`；zip 校验报告少数瓦片 CRC/offset 异常 |
| P1-2 | 构建真实秦岭 DEM | 已完成 | `public/data/qinling-slice-dem.json` 的 `sourceType` 为 `processed-real-dem` |
| P1-3 | 重建秦岭 region/chunk 资产 | 已完成 | `slice-l1.json` 和 chunks 同步为真实 DEM 来源 |
| P1-4 | 运行数据校验 | 已完成 | `npm run verify:dem` 通过，并显示 POI/story/chunk 均 OK |
| P1-5 | 运行生产构建 | 已完成 | `npm run build` 通过 |
| P1-6 | 浏览器实测 | 已完成第一轮 | in-app browser 可加载当前页面，地貌总览面板可打开 |

## 真实 DEM 接入备注

- 本地最终 archive 已下载到 `data/fabdem/qinling/archives/N30E100-N40E110_FABDEM_V1-2.zip`，大小约 2.51 GB。
- `unzip -t` 报告少数瓦片 CRC/offset 异常；当前已从 archive 中成功解出 97 个 TIFF。
- 构建脚本已能递归读取 tiles，并在缺失/损坏瓦片位置使用邻近有效数据插值补齐。
- 当前 `qinling-slice-dem.json` 与 region/chunk 资产均为 `processed-real-dem`，不是程序化 placeholder。

## 地貌表达修正记录

- 问题：首版真实 DEM 虽然数据里有低地，但运行时把全局水面固定在 `y=0.2`，而关中、汉中、成都平原被归一化到负高度，导致低地视觉上像被海覆盖。
- 问题：chunk scenery 原本按每个 chunk 的局部高度范围撒树，低地附近也容易出现过密、过高的树，让山体读成树林墙。
- 修正：真实 DEM 视觉高度范围当前为约 `-4..17.419`，并在资产内写入显式 `presentation.waterLevel`、`underpaintLevel`，避免低地被当成海。
- 修正：运行时水面与外缘底色改为跟随 DEM presentation，不再覆盖平原/盆地；树木改用全局高度范围判断，并降低高度与密度。
- 修正：真实 DEM 生成阶段加入一层温和低通平滑，降低格子级尖峰噪声，但保留秦岭主脊相对关中/汉中的高差。
- 修正：汉中盆地 POI、剧情目标和残简位置改到真实汉中低地区域附近。
- 修正：关中到汉中的四条古道改为贴地路带，并参与移动速度加成，避免只在缩略图上可见。
- 回归：`npm test` 会检查关中、汉中、成都低地不被水面覆盖，秦岭主脊仍高于关中，且局部起伏不过度针状化。

## P2 真实 DEM 接入后的质量校正

| ID | 任务 | 状态 | 验收标准 |
| --- | --- | --- | --- |
| P2-1 | 检查真实地形大关系 | 已完成第一轮 | 关中、秦岭、汉中、入蜀、成都平原的空间节奏可读 |
| P2-2 | 调整高度归一化曲线与局部平滑 | 已完成第一轮 | 山体有压迫感，但不导致移动和镜头过度抖动 |
| P2-3 | 调整 river/pass/settlement mask | 待执行 | 生活、战争、军事视图能反映主要地貌逻辑 |
| P2-4 | 修正 routeStart 和 POI 高度/位置 | 已完成第一轮 | 出生点、残简、地标都落在合理地形位置 |
| P2-5 | 调整主线完成半径 | 待执行 | 主线不会误触发，也不会难以推进 |
| P2-6 | 古道视觉与移动反馈 | 已完成第一轮 | 视觉上能看到主要古道，行动上沿路更快、离路更慢 |

## P2.5 2D Atlas 工作台

| ID | 任务 | 状态 | 验收标准 |
| --- | --- | --- | --- |
| P2.5-1 | Atlas 数据源 | 已完成第一轮 | `src/game/qinlingAtlas.js` 含地貌、水系、城市、关隘、古道、军事、民生、人文图层 |
| P2.5-2 | Atlas 渲染策略 | 已完成第一轮 | `npm test` 覆盖默认可见图层、绘制顺序和坐标投影 |
| P2.5-3 | 地貌总览接入 Atlas | 已完成第一轮 | HUD 总览从 Atlas feature 绘制核心层 |
| P2.5-4 | 水系显式建模 | 已完成第一轮 | 渭河、汉水、嘉陵江、褒水、斜水存在于 Atlas 并在 3D 中可见 |
| P2.5-5 | 图层开关 UI | 已完成第一轮 | 用户可按地貌、水系、古道、城市、关隘、军事、民生、人文筛选 |
| P2.5-6 | Feature 信息卡 | 已完成点击第一轮 | 点击 feature 能看到地理、历史、人文、玩法解释；悬停待做 |
| P2.5-7 | 标签避让与专题模式 | 待执行 | 默认视图不拥挤，专题模式能逐层展开信息 |
| P2.5-8 | 全屏 Atlas Workbench | 已完成第二轮 | `M` 键打开全屏地图，支持滚轮缩放、拖拽平移、双击复位，用于游玩导航和开发校对 |

## P2.6 现代水系准确化

| ID | 任务 | 状态 | 验收标准 |
| --- | --- | --- | --- |
| P2.6-1 | Hydrography 数据模型 | 待执行 | 水系 feature 有名称、等级、流域、来源、可信度和关系字段 |
| P2.6-2 | 秦岭现代水系资产 | 待执行 | 渭河、汉江/汉水、嘉陵江、褒河、斜水进入独立 hydrography asset |
| P2.6-3 | 水系 LOD 规则 | 待执行 | L0/L1/L2 能按 rank 控制显示密度 |
| P2.6-4 | 水系 DEM 校验 | 待执行 | 能报告河线与低地/谷地不吻合的位置 |
| P2.6-5 | 水系与道路/POI 关系 | 待执行 | 褒斜道、陈仓道、汉中盆地、关中平原能通过水系关系解释 |

## P3 开放世界架构继续推进

| ID | 任务 | 状态 | 验收标准 |
| --- | --- | --- | --- |
| P3-1 | region registry | 待执行 | 支持注册多个区域 manifest，而不是只靠单个 URL |
| P3-2 | world manifest 原型 | 待执行 | 能描述全国低精度母版和重点区域入口 |
| P3-3 | 多区域切换策略 | 待执行 | 从一个 region 进入另一个 region 时能保持运行时状态稳定 |
| P3-4 | chunk 预加载策略优化 | 待执行 | 玩家接近边界时提前拉取，不明显闪烁 |
| P3-5 | scenery 类型扩展 | 待执行 | 树、草、聚落、城郭占位可分层控制 |
| P3-6 | 严格地理坐标与体验压缩契约 | 已完成第一轮 | 缩略图、游戏平面、POI、路线共用线性地理映射；速度/镜头/密度负责体验压缩 |
| P3-7 | Gate Entrance stubs | 待执行 | 总览地图可显示局部场景入口，但暂不切换场景 |
| P3-8 | Local Scene manifest contract | 待执行 | 可描述局部场景范围、入口、返回点和资产 |
| P3-9 | Era Overlay contract | 待执行 | 现代为基础，历史要素作为 overlay 数据层 |

## P4 体验打磨

| ID | 任务 | 状态 | 验收标准 |
| --- | --- | --- | --- |
| P4-1 | 第三人称镜头继续调校 | 待执行 | 更接近 Journey + Zelda 的天空、远山、角色空间关系 |
| P4-2 | 主线提示表现优化 | 待执行 | HUD 可读但不压迫画面，不像任务清单游戏 |
| P4-3 | 重点区性能观察 | 待执行 | 保持入口包轻，运行时对象数量受预算控制 |
| P4-4 | 移动手感校正 | 待执行 | 坡度、山口、平原速度差异可感但不烦躁 |

## P5 文档与代码整编

| ID | 任务 | 状态 | 验收标准 |
| --- | --- | --- | --- |
| P5-1 | 文档入口 | 已完成第一轮 | `docs/README.md` 给出推荐阅读顺序 |
| P5-2 | 上下文压缩摘要 | 已完成第一轮 | `docs/context-summary.md` 一页说明目标、架构、完成度、问题和下一步 |
| P5-3 | README 状态修正 | 已完成第一轮 | README 不再把当前 DEM 描述为程序化占位 |
| P5-4 | 小范围代码整理 | 已完成第一轮 | Atlas 坐标函数从 `main.ts` 抽到 `atlasRender.js` 并有测试 |
| P5-5 | `main.ts` 持续拆分 | 待执行 | 场景对象、HUD 绘图、输入、更新循环逐步模块化 |

## 当前并行工作

- 主线程：已整合真实 DEM、更新任务看板，并完成数据/构建验证。
- Agent A：已完成真实秦岭 DEM 下载完成后的脚本链路风险审查。
- Agent B：已完成秦岭 DEM 下载与资产状态检查工具。

## 下载完成后的标准命令流

标准命令流如下：

```bash
npm run qinling:fabdem:extract
npm run qinling:dem:build-real
npm run verify:dem
npm run build
```

如果下载中断，先使用可续传下载：

```bash
npm run qinling:fabdem:download
```

如果 archive 存在但 `unzip -t` 报告局部瓦片损坏，当前策略是先保留 archive、尽量解出可用 TIFF，再用真实 DEM 构建脚本生成可运行切片；后续质量校正阶段再补齐或重下损坏瓦片。
