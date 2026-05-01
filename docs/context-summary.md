# 上下文压缩摘要

更新时间：2026-05-01

## 一句话目标

做一个介于开放世界游戏和交互展览之间的“中国地理叙事”浏览器原型：玩家以第三人称方式在严格地理坐标映射的中国地貌中漫游，通过地形、水系、道路、城市、关隘和故事线理解历史、地理、人文之间的关系。

## 当前垂直切片

当前聚焦 `秦岭 - 关中 - 汉中 - 四川盆地`。这个切片用来验证四件事：

- 真实 DEM 能不能进入浏览器并被游戏化表达。
- 关中平原、秦岭主脊、汉中盆地、剑门入蜀、成都平原之间的大地形关系能不能被看懂。
- 玩家沿古道行动时，视觉和移动反馈能不能体现“走人走的路更快，离路更难”。
- 二维地貌总览图能不能作为 POI、水系、路线、文案和 3D 表现的统一信息源。

## 当前架构状态

- 运行时：`Vite + TypeScript + Three.js`。
- 默认入口：`public/data/regions/qinling/manifest.json`。
- 地形资产链路：`region manifest -> LOD DEM asset -> chunk manifest -> POI/story content`。
- DEM：秦岭切片已接入 `processed-real-dem`，并生成整区底图、分块 chunk 和 POI content。
- 坐标：缩略图和 3D 游戏地形共用严格地理坐标映射；体验压缩通过速度、镜头、细节密度、事件密度完成。
- Streaming：已有近身 chunk terrain、外圈保留 chunk、轻量 scenery 生命周期。
- 叙事：已有 6 段主线推进和残简收集系统。
- 2D Atlas：已建立 `qinlingAtlas` 数据源，包含地貌、水系、城市、关隘、道路、军事、民生、人文图层，并开始升级为可全屏细读的 Atlas Workbench。
- 多尺度地图：当前秦岭切片定位为 `Overworld Atlas`；未来可通过入口节点进入更细的 `Local Scene`。
- 历史年代层：近期以现代 DEM 和现代基础地理为主，未来通过 `Era Overlay` 表达河道、湖泽、关隘、城市和道路意义的历史变化。
- 现代水系：已建立第一版独立 hydrography 事实层、秦岭 modern asset、LOD rank 规则、Atlas 转换器和 DEM mismatch report；当前仍是 curated skeleton，下一步接 HydroRIVERS/OSM/MERIT Hydro 真实源。

## 已完成的关键能力

- 真实秦岭 DEM 构建与验证。
- DEM 高度范围、水面/底色 presentation 处理，避免平原和盆地被“海”覆盖。
- 地形平滑与视觉尺度第一轮修正，降低针状山脊噪声。
- WASD 按镜头方向移动。
- 第三人称木马角色，马头朝移动方向，腿有简单摆动。
- 昼夜、天气、季节、月亮、星空、云层的基础环境系统。
- 关中到汉中的主要古道：陈仓道、褒斜道、傥骆道、子午道。
- 汉中入蜀路线：金牛道/剑门蜀道。
- 显式水系骨架：渭河、汉水、嘉陵江、褒水、斜水，已从 Atlas 硬编码迁到 hydrography asset 派生。
- 2D 地貌总览可从 Atlas 绘制核心地貌、水系、古道、城市、关隘。
- Atlas Workbench 第二轮：支持 `M` 键全屏、滚轮缩放、拖拽平移、双击复位、图层筛选、点击 feature 查看地理/历史/玩法解释。

## 主要未解决问题

- 3D 地形仍然不够像“真实关中-秦岭-汉中”的总体关系，局部仍显得过碎、过尖、粒度过一致。
- 2D Atlas 已有图层开关、点击信息卡和全屏工作台，但还缺少标签避让、专题模式、搜索和更精细的开发校对工具。
- 水系已有独立 hydrography asset、来源等级、LOD rank 和 DEM mismatch report 第一版；尚未接入真实 HydroRIVERS/OSM/MERIT Hydro 数据导入。
- 路线在 3D 中已经弱化，但还需要从“提示覆盖层”进化成更自然的道路/河谷/栈道视觉。
- `src/main.ts` 仍然过大，需要继续拆出渲染、输入、场景对象生命周期等模块。
- 全国开放世界架构已有原则，但还没有 region registry、world manifest 和多区域切换。
- 多尺度入口和历史年代层已有架构方向，但还没有运行时数据契约和可见入口节点。

## 当前验证命令

```bash
npm test
npm run verify:dem
npm run build
```

最近一次完整验证目标：

- Node 测试全部通过。
- DEM manifest、chunk、POI/story content 校验通过。
- TypeScript 和 Vite 生产构建通过。

## 当前 Git 状态

- GitHub 远程：`git@github.com:fancify/visual_china.git`
- 主分支：`main`
- 初始同步 commit：`4c6469d feat: initialize visual china prototype`
- 大文件策略：`node_modules/`、`dist/`、`data/fabdem/` 不进 Git；派生后的可运行 JSON 资产保留在 `public/data/`。

## 下一步判断

不要继续在 3D 里盲调单个视觉点。下一阶段应该以 `2D Atlas 工作台 -> 3D 回灌` 为主线：

1. 继续把二维总览图从第一版全屏工作台推进到可搜索、可专题切换、可标签避让的地理信息工作台。
2. 再用 Atlas 的图层和 feature role 驱动 3D 水系、道路、关隘、地貌粒度。
3. 最后把移动速度、叙事触发、镜头尺度和重点区域性能预算接入同一套 feature 数据。
4. 多尺度地图和历史年代层先按架构预留推进，不抢当前现代 Atlas、水系和 POI 的优先级。
