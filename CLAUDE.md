# CLAUDE.md — 山河中国项目本地约定

> 项目本地协作约定（global CLAUDE.md 已覆盖通用规则）。新会话自动读到。

## 项目身份

- **目标**：浏览器 3D 中国地理叙事原型，第一个 epoch = 唐玄宗 天宝十四年 (755 AD)
- **Stack**：Three.js + TypeScript + Vite + Node 25
- **状态**：6-step refactor 中（见 todo.md）

## 工作流

- **写代码** — Claude 主导；S2 commit 起类型债已大幅清理，新代码必须有 TS 类型
- **代码评审** — codex 是 critic（`/codex review` 或 codex CLI 直接消费）
- **每个 S step 完成后**：跑 `npm test`、`npm run regression:baseline`、`npx tsc --noEmit`，用户 review，再进下一 step

## 编码约定

### TypeScript / JS

- **`.ts` 是 canonical**——所有源文件应是 `.ts`。types 内联（不再 .d.ts 分离）。
- **`.js` 只作 shim**——为兼容 `scripts/*.test.mjs` 的 raw-node ESM (它不解析 `.js` 到 `.ts`)，每个被测试 import 的 `.ts` 需要一个 `Module.js` 文件内容仅 `export * from "./Module.ts";`。**不要在 `.js` 里写实现**。
- **import 后缀**：runtime 代码用 `.js` 后缀（Vite + tsc Bundler 解析到 .ts）；test 代码可用 `.ts` 后缀或 `.js`（shim）。**不要混用**。
- **tsconfig**：`strict: true`、`target: ES2023`、`moduleResolution: "Bundler"`、`noEmit: true`（type-only 检查）。

### SSOT-by-design (6 条)

1. 数据事实只能一个 authoring source；其他文件 import/derive/validate
2. Generated 文件写明来源 + 禁止手改
3. 测试分两类：contract snapshot（故意 hardcode）vs 普通一致性（必须 import）
4. Manifest 是 build artifact，不是 authoring source（`scripts/ssot-drift.test.mjs` 守住）
5. 新增 enum/id 必须从 registry 派生
6. Docs 不承载可执行事实

详见 `memory/feedback_ssot_by_design.md`。**违反前问用户**。

### Tang 755 Epoch 一致性

第一个（也是唯一） epoch = 天宝十四年 (755 AD) 安史前夜。当前数据已 rename 30+ 现代名到 Tang 真名（西安→长安、北京→幽州、汉中→梁州、宝鸡→岐州 等）。详见 `docs/tang-epoch-755-poi-database.md`。

**写新城市/POI/路线时**：
- 用 Tang 名作 `name` 字段；id 暂保留（S4 epoch schema 时统一 rename）
- 不引入近代地名（上海/天津/深圳等）作为 Tang epoch 一部分
- 描述文本避免提及"宋/明/清/近代"
- 不存在的城市（现代港口城市等）见 `tang-epoch-755-poi-database.md` ✗ 标记，不要加入 Tang epoch 数据

### 测试组织

- `npm run test:fast` (~200ms) — 契约/math/snapshot；S3-S6 每个改动都该跑
- `npm run test:visual` (~36s) — 渲染/几何/runtime
- `npm run test:data` (~1s) — DEM/POI/atlas validation
- `npm run test:audio` (~100ms) — audio 子系统
- `npm test` — 4 个 sequential，~38s 总

### Regression baseline

`scripts/regression-baseline.test.mjs` 是 19 case **contract snapshot**——故意 hardcode `FOOT_OFFSET=0.03` 等常量而**不** import main.ts，保证 S5 runtime split 时不连环爆。普通测试反向：必须 import constant。

## 不做清单（详见 todo.md）

12 条 "不做"——核心：不做 normal map / FFT 风 / 真体积云 / 物理大气 / 常驻 BGM / chemistry engine / 全中国近景 BotW 草海 / 24 节气独立 shader / hydrosheds 当海岸线 / `if epoch ===` 硬塞 / 远景加 detail / `yOffset/lerp` 补穿模。

## 文件位置约定

- **新 module** → `src/game/Xxx.ts` (S5 后 → `src/game/runtime/XxxRuntime.ts` 或 `src/game/<domain>/Xxx.ts`)
- **新 data file** → `src/data/*.ts` (静态) 或 `src/game/data/*.js` (auto-generated, 配套 generator script)
- **新 build script** → `scripts/build-*.mjs`
- **新 test** → `scripts/*.test.mjs` (S6 后可能迁 `tests/`)
- **新 doc** → `docs/*.md`（active）或 `.archive/docs/*.md`（历史）
- **constants** → 优先放对应 module 内 export；只有跨 module 的 SSOT 才单独提取

## Codex session

`.context/codex-session-id` 保存当前 codex consult session ID，可 resume 继续对话。已 gitignored。

## 当前 6-step refactor 进度

见 [todo.md](./todo.md) 和 [memory/project_refactor_plan_v1](.claude/projects/-Users-chen-Documents-GitHub-visual-china/memory/project_refactor_plan_v1.md)。

```
✅ S1 Baseline    ✅ S2 TS hygiene   ✅ CL cleanup    ✅ SSOT
⏳ S3 SurfaceProvider (next)   ⏳ S4 Epoch    ⏳ S5 Runtime split    ⏳ S6 Hero slice
```

## 紧急 reminder

- `qinlingAtlas.ts` 顶 `@ts-nocheck` — S5 ContentRuntime 时合并修
- `data/qinlingNeRivers.js / qinlingRouteAnchors.js` 无 `.d.ts` — `@ts-ignore` 临时；S5 类型补全
- `main.ts` 内 `await Promise.resolve()` init-order hack（`loadHydrographyAtlas`）— S5 runtime split 时根治
