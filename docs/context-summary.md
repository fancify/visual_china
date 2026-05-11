# 上下文压缩摘要

更新时间：2026-05-11

## 一句话目标

做一个介于开放世界游戏和交互展览之间的"中国地理叙事"浏览器原型：玩家以第三人称方式在严格地理坐标映射的中国地貌中漫游，通过地形、水系、道路、城市、关隘和故事线理解历史、地理、人文之间的关系。

## 当前 Branch + Epoch

**Branch**: `feature/full-china-1800m-hydrosheds`

**第一个 Epoch（也是当前唯一）**: **唐玄宗 天宝十四年 (755 AD) 安史前夜**

- **地形**: 复用现有 1800m 全国 DEM（现代地形，1300 年尺度上山系基本不变）
- **Tang overlay 必须重写**: 黄河北流走天津方向 / 济水独流入海 / 隋唐大运河（永济渠+通济渠+邗沟+江南河，以洛阳为中心）/ 淮河独流入海 / 永定河叫桑干河 / 唐代 15 道行政区划 / 长安+洛阳两京
- **冻结理由**: 盛唐最后的余晖；杜甫《自京赴奉先县咏怀》、李白江南漫游、王维辋川别业都在这一年；行政区划仍是开元 15 道制未崩

## 7-Step Refactor 进展（2026-05-11）

| Step | 状态 | 内容 |
|---|---|---|
| S1 Baseline Regression Gate | ✅ | 19 case 锁定契约，`npm run regression:baseline` |
| S2 TS/Test Hygiene | ✅ | 28 .d.ts 删除，27 .ts canonical + .js shim，npm test 拆 fast/visual/audio/data |
| S3 SurfaceProvider + DistanceBand | ⏳ 下一步 | 统一地表契约根治穿模；扩 SurfaceState (wet/snow/dust/footstep/traction) |
| S4 Epoch Schema v3 | ⏳ | 第一份 epoch = tang-tianbao-14；含 LandmarkHierarchy (Triangle Rule) |
| S5 Runtime Split | ⏳ | main.ts 6263 → 6 runtime (Terrain/Surface/Water/Content/Environment/Player) |
| S6 Hero Visual Slice | ⏳ | 一条唐风山水路线 + BotW 技巧融合（fog inscatter / VisualProfile / 草法线 / 树叶 edited normals / context-triggered swell / 前景 silhouette） |
| S7 Post-Refactor Polish | ⏳ | Biome format/lint + `noUncheckedIndexedAccess` + `tests/` 实体迁移 + nightly CI |

参考：[7-step plan 详情（memory）](../../.claude/projects/-Users-chen-Documents-GitHub-visual-china/memory/project_refactor_plan_v1.md)

## 当前架构状态

- 运行时：`Vite + TypeScript + Three.js`，Node 25, tsc strict + ES2023 lib
- 默认入口：`public/data/regions/qinling/manifest.json`
- 地形资产链路：`region manifest -> LOD DEM asset -> chunk manifest -> POI/story content`
- 全国坐标投影：`73-135°E × 18-53°N → 1711 × 1186 world units`，~3.27 km/u
- 主入口文件：`src/main.ts`（6263 行，S5 拆 6 runtime）
- 测试：~85 文件，分 fast/visual/audio/data 4 组，`npm run test:fast` 200ms 跑完
- 类型债：`qinlingAtlas.ts` 有 `@ts-nocheck` 待 S5 ContentRuntime 时修；`data/*.js` 几个无 .d.ts 暂用 `@ts-ignore`

## 已完成的关键能力

- 真实秦岭 DEM 构建与验证（FABDEM → chunk manifest 全国级管线）
- WASD 按镜头方向移动；第三人称玩家
- 昼夜（24h）、季节、天气（state lerp）、月相、星空、云层、cloud cookie 地面阴影
- 关中-汉中-蜀道：陈仓道 / 褒斜道 / 傥骆道 / 子午道 / 金牛道 / 米仓道 / 祁山道 / 荔枝道
- 28 个真实城市（lat/lon 验证）3-tier 显示
- 显式水系骨架（渭河、汉水、嘉陵江、褒水、斜水 + OSM 4639 条命名水系）
- 2D Atlas Workbench：图层筛选、缩放、拖拽、feature 详情
- LOD morph（R6/R10a）、atmospheric haze（R5）、WindManager（R7）、风+草

## 主要未解决问题（待 S3-S7 修）

- **穿模/错漏**：模块各自采样地形，无统一 ground contract → S3 SurfaceProvider 解决
- **高视角河 ribbon 看不见**（polygonOffset 排序问题）→ S3 几何 + S6 distance band
- **main.ts 6263 行 god file** → S5 按 runtime contract 拆分
- **没有时间切片支持** → S4 epoch schema
- **视觉跟 BotW/长安三万里/Journey 差距** → S6 hero slice
- **没有 Tang overlay 数据**（黄河故道、济水、隋唐运河、唐代 POI 等）→ S4 数据迁移

## 当前验证命令

```bash
npm run test:fast           # ~200ms, contract + math
npm run regression:baseline # 19 cases
npm test                    # 全量 4 组（~38s）
npm run verify:dem
npm run build               # tsc + vite build
```

## Git

- Remote: `git@github.com:fancify/visual_china.git`
- 当前 branch: `feature/full-china-1800m-hydrosheds`（含 S1+S2 commit）
- 大文件：`node_modules/`、`dist/`、`data/fabdem/`、`*.bin`、`public/data/qinling-slice-dem.json` 不进 Git
- Codex consult session: 保存在 `.context/codex-session-id`，可续聊

## 下一步

**S3 SurfaceProvider**——为所有 player/camera/city/POI/water/vegetation/label 提供统一地表契约，根治"audit P0 / R10a 又抓 3 个" 回归循环。详见 7-step plan memory。
