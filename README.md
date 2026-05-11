# 山河中国 · Web 原型

浏览器端 3D 地理叙事原型——介于开放世界游戏和交互展览之间，以严格地理坐标在中国地貌中漫游。

`Three.js + TypeScript + Vite`，无后端，纯前端可部署。

## 当前阶段（2026-05-11）

- **Branch**: `feature/full-china-1800m-hydrosheds`
- **地理范围**: 全中国 73-135°E × 18-53°N（1711 × 1186 world units, ~3.27 km/u）
- **第一个 Epoch**: 唐玄宗 **天宝十四年 (755 AD) 安史前夜**——现代 DEM + 唐代水系/城市/POI overlay
- **进行中**: 7-step refactor plan（Claude × Codex × BotW 三轮对齐版 + PM audit S7）
  - ✅ S1 Baseline regression gate（19 cases, `npm run regression:baseline`）
  - ✅ S2 TS/Test hygiene（28 .d.ts → .ts，npm test 拆 4 组）
  - ✅ CL Cleanup + Tang anachronism rename
  - ✅ SSOT audit (5 fixed, 5 deferred to S3-S5)
  - ✅ PM audit (ARCHITECTURE / CLAUDE.md / CONTRIBUTING / CI)
  - ⏳ S3 SurfaceProvider + DistanceBand（下一步，打穿模根因）
  - ⏳ S4 Epoch Schema v3（迁数据到 Tang 755 + qinling* → region* rename）
  - ⏳ S5 Runtime split（main.ts 拆 6 runtime）
  - ⏳ S6 Hero visual slice（唐风山水路线 + BotW 技巧）
  - ⏳ S7 Polish（Biome + strictness sprint + tests/ 迁移 + nightly CI）

详情：[docs/context-summary.md](./docs/context-summary.md) / [docs/README.md](./docs/README.md)

## 已实现

**地形 / 体系**
- 真实 FABDEM 数据 + HydroSHEDS 河网；秦岭 L1 切片 + 全国 1800m 母版
- Region manifest → LOD DEM asset → chunk manifest → POI/story content
- 近身 chunk terrain + 外圈保留 chunk 的 streaming 窗口
- LOD morph（R6/R10a 圆形边界）+ atmospheric haze + cloud cookie 地面阴影

**游玩**
- WASD 移动，第三人称镜头 360° 旋转
- 骑乘系统（马、狐、猪、野猪、鸡、筋斗云）+ 飞行 mount 绝对高度
- 24h 昼夜循环 + 季节切换 + 天气 state lerp + 程序化环境音

**内容**
- 28 个真实城市（lat/lon 验证）3-tier 显示
- 11 条历史古道：陈仓道 / 褒斜道 / 傥骆道 / 子午道 / 金牛道 / 米仓道 / 祁山道 / 荔枝道 / 茶马道 / 湘黔道 / 关中走廊
- 显式水系：渭河、汉水、嘉陵江、长江、金沙江、岷江、乌江、沱江 + OSM 4639 条命名水系
- 4 种观察模式：地形 / 生活 / 战争 / 军事
- 知识收集（残简拾取 → 山河札记）

**UI**
- 2D Atlas Workbench：图层筛选、缩放、拖拽、feature 详情
- `M` 全屏 atlas / `J` 札记 / `K` 切天气 / `L` 切季节

## 启动

```bash
npm install
npm run build:dem        # 生成秦岭切片资产（首次必跑）
npm run verify:dem
npm run dev
```

浏览器控制：

- `WASD` 移动 / `Q/E` 转向
- `M` 全屏 atlas / `J` 札记
- `K` 切天气 / `L` 切季节
- 全屏 atlas 内：滚轮缩放 / 拖拽平移 / 双击复位

音频需浏览器交互授权——点击页面一次启用。

## 全国 DEM 管线

```bash
npm run china:fabdem:download -- --dry-run
npm run china:fabdem:download -- --limit=1
npm run china:fabdem:extract
npm run china:dem:build
```

完整全国母版下载是长任务，按 `--limit` 分批。文档：[docs/china-national-dem.md](./docs/china-national-dem.md)

## 真实秦岭 DEM 重建

```bash
npm run qinling:fabdem:download
npm run qinling:fabdem:extract
npm run qinling:dem:build-real
npm run verify:dem
```

## 测试

```bash
npm run test:fast          # 200ms 契约+数学
npm run regression:baseline # S1 baseline 19 cases
npm test                    # 全量 ~38s (fast + visual + data + audio)
npm run build               # tsc + vite build
```

## 文档

- [docs/README.md](./docs/README.md) — 文档入口
- [docs/context-summary.md](./docs/context-summary.md) — 一页架构 + 进度
- [docs/regression-baseline-2026-05-11.md](./docs/regression-baseline-2026-05-11.md) — S1 baseline 报告
- [todo.md](./todo.md) — 当前任务

## License

私有原型，未发布。
