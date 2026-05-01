# 山河中国 · Web 原型

这是一个浏览器端 3D 原型，当前聚焦在首个垂直切片：

`秦岭 - 关中 - 汉中 - 四川盆地`

目标不是制作 1:1 GIS 地图，而是把真实地形关系压缩成一个可漫游、可收集、可体会的游戏世界。

## 当前实现

- `Three.js + TypeScript + Vite`
- 可配置第三人称镜头，支持 360 度旋转观察，并开始向更低、更能看到天空和远山的视角推进
- 以秦岭切片为核心的地形原型
- 区域 manifest + chunk manifest 驱动的秦岭样板区域入口
- 低精度整区底图 + 近身 chunk terrain 叠加的第一版 lazy load 地形结构
- 近身可见 chunk + 外圈保留 chunk 的基础 streaming / 卸载窗口
- 按 chunk 生成和卸载的轻量 instancing 植被 / 聚落占位层
- 运行时性能预算配置：
  - 可见 chunk 半径
  - 保留 chunk 半径
  - 最大加载 terrain chunk 数
  - 每个 chunk 的树与聚落占位数量上限
- 骑马漫游与坡度影响移动速度
- 24 小时昼夜循环、季节切换与基础天气系统
- 夜空星点、地表季节性色调与天气驱动的视觉过渡
- 程序化环境音骨架：
  - 风声
  - 近水水声
  - 雨雪氛围
  - 夜间虫鸣感与轻量环境旋律占位
- 四种观察模式：
  - 地形
  - 生活
  - 战争
  - 军事
- 轻量知识收集系统：
  - 世界内拾取残简
  - 一句短提示即时出现
  - 完整内容进入“山河札记”
- 第一版主线叙事骨架：
  - 关中起行
  - 逼近秦岭
  - 穿过山口
  - 抵达汉中
  - 再向入蜀
  - 进入盆地
- 2D Atlas-first 信息底图：
  - 地貌、水系、城市、关隘、古道、军事、民生、人文图层
  - 渭河、汉水、嘉陵江、褒水、斜水显式建模
  - 地貌总览从 Atlas 数据绘制，而不是在 3D 中临时堆调试标记
  - `M` 键打开全屏 Atlas Workbench，可筛选图层并点击查看 feature 解释

## 启动

```bash
npm install
npm run build:dem
npm run verify:dem
npm run dev
```

浏览器内可直接预览这些控制：

- `WASD` 移动
- `Q / E` 转向
- `J` 打开札记
- `M` 打开 / 关闭全屏地貌总览
- 全屏地貌总览内可滚轮缩放、拖拽平移、双击复位
- `K` 切天气
- `L` 切季节

音频需要浏览器交互授权，所以进入页面后点击一次画面即可启用环境声。

仓库里已经生成了一份可运行的原型母版资产：

- [qinling-slice-dem.json](/Users/chen/Documents/GitHub/visual_china/public/data/qinling-slice-dem.json)
- [qinling region manifest](/Users/chen/Documents/GitHub/visual_china/public/data/regions/qinling/manifest.json)

这份资产当前已经是从真实 FABDEM 处理出的秦岭切片派生资产，`sourceType` 为 `processed-real-dem`。

如果要生成真实秦岭 DEM 切片，可使用单区域脚本链：

```bash
npm run qinling:fabdem:download
npm run qinling:fabdem:extract
npm run qinling:dem:build-real
npm run verify:dem
```

也可以通过 URL 参数切换资产，例如：

```text
http://localhost:5173/?dem=/data/your-real-dem.json
```

当前运行时也支持把 `?dem=` 指向一个未来的区域 manifest，
运行时会自动读取其首个地形 LOD。

当前默认入口已经切到秦岭区域 manifest，而不是直接读取单一切片文件。
这意味着运行时已经开始按 `region -> lod asset -> chunk manifest -> poi manifest` 的结构组织秦岭样板区域。
当前验证脚本也会连同 chunk manifest 与 chunk 资产一起校验。

## 全国 DEM 管线

仓库里现在也有“整中国母版”的脚本链：

```bash
npm run china:fabdem:download -- --dry-run
npm run china:fabdem:download -- --limit=1
npm run china:fabdem:extract
npm run china:dem:build
```

如果只是做探索性的小样本实验，而不是生成可信全国母版，可显式允许部分覆盖率构建：

```bash
npm run china:dem:build -- --allow-partial
```

对应文档：

- [全国中国 DEM 母版方案](./docs/china-national-dem.md)

当前全国流程先用 `FABDEM V1-2` 打通，输出：

- [china-national-dem.json](/Users/chen/Documents/GitHub/visual_china/public/data/china-national-dem.json)

注意这份全国资产目前只是“真实压缩包样本驱动的流程验证版”，还不是完整下载全国分块后的最终母版。
全国下载本身会是一个长任务，建议按 `--limit` 分批执行。

## 文档

- [文档入口](./docs/README.md)
- [上下文压缩摘要](./docs/context-summary.md)
- [开发任务看板](./docs/development-task-list.md)
- [下一阶段计划](./docs/next-phase-plan.md)

## 说明

当前 DEM 管线已经拆成两层：

- 场景运行时默认读取 `public/data/regions/qinling/manifest.json`
- 区域清单再指向切片 DEM、chunk manifest 与 POI manifest
- 运行时会保持整区底图连续显示，并对玩家附近 chunk 做分块 terrain 激活
- 树、聚落这类未来重点区资产已经先走 chunk 生命周期，不随全国一次性常驻
- 主线 HUD 会根据玩家推进阶段给出当前叙事目标，不再只是纯自由乱逛
- 原型母版与秦岭区域包由 `npm run build:dem` 一起生成

这意味着后面切换成真实高程时，主要工作会落在“生成资产”这一步，而不是重写场景。

下一阶段会把这套切片替换为：

- 真实 DEM 裁切结果
- 降采样和平滑后的高度场
- 在真实高程骨架上的游戏化夸张层
