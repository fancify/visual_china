# 协作者快速入门

欢迎一起干活。这是 3D 浏览器原型——中国地理 + 唐代天宝十四年 (755 AD) 叙事，技术栈 Three.js + TypeScript + Vite + Node 25。

## 5 分钟启动

```bash
# 浅 clone（只下最新一份 ~400MB，5 分钟）
git clone --depth 1 git@github.com:fancify/visual_china.git
cd visual_china
npm install
npm run dev
```

浏览器打开 **http://localhost:5173/pyramid-demo.html**

如果没配 SSH，用 HTTPS：
```bash
git clone --depth 1 https://github.com/fancify/visual_china.git
```

如果之后想看完整历史（含 2GB 旧 chunks）：
```bash
git fetch --unshallow
```

---

## 当前活跃 demo

**`pyramid-demo.html`** — 千里江山图风地形 + 角色 + 御剑 / 筋斗云飞行 + 实时天气季节。

老的 `index.html` 已废弃（依赖 `regions/qinling/chunks/` 旧数据，不在 git 里）。

---

## 控制方案

刚做完一轮重构（2026-05-15），目前键位：

| 键 / 鼠标 | 行为 |
|---|---|
| **W A S D** | 沿镜头方向走（人物自动 face 移动方向） |
| **Shift** | 加速跑 |
| **Space / Ctrl** | 飞行上 / 下（在 sword / cloud 模式下）|
| **P** | 切坐骑：走 / 御剑 / 筋斗云 |
| **左键 / 右键 拖** | 转镜头（人物不动）|
| **Q / E** | 键盘转镜头 |
| **滚轮** | 缩放（最近 0.5m）|
| **F** | 复位到正后方 1.6m 水平视角 |
| **O** | 鸟瞰最大距离 |
| **V** | 沉浸模式（pointer lock）|
| **T / L / K** | 切时辰 / 季节 / 天气 |
| **M** | 切大地图（全屏 atlas）|
| **I** | POI 详情 |
| **\`**（反引号）| 调试面板（toggle / slider / dropdown）|
| **Esc** | 关最上层 UI / 退锁定 |

debug 面板里可以实时调：人物高度（地面 / 剑面 / 云面）、人物 emissive、time 滑条、weather 下拉等。

---

## 想优化的视觉方向

挑感兴趣的下手。每一项我尽量给入口文件 + 思路。

### 1. 地形 (terrain)
**入口**：`src/game/terrain/pyramidMesh.ts`、`pyramidBootstrap.ts`、`pyramidLoader.ts`

- LOD 切换有接缝感（默认 150 / 300 / 600 三段切换距离）— 可加 alpha fade 让过渡隐形
- 远景大气透视 (atmospheric perspective) — distance fog 现在是简单线性，可换 sky-tinted exponential
- 颜色风格偏冷绿 — 试 BotW 暖调、千里江山图青绿、唐代水墨等
- vertex shader 内可加 height-based tint（雪线、岩石带、河谷绿）
- 法线烘焙：现在 procedural normal，可以试预烤 normal map

### 2. 水流 (rivers)
**入口**：`src/game/terrain/riverRenderer.ts`

- 现在 LineSegments2 batched 渲染，配色统一
- 可加：流动方向（UV 滚动 shader）、按 stream order 染色（干流深、支流淡）、岸边 alpha fade、reflection
- 河面闪烁现在是简单 sin，可换 Voronoi / FBM

### 3. 湖泊 (lakes)
**入口**：`src/game/terrain/lakeRenderer.ts`、`waterSystemVisuals.ts`

- polygon meshes，flat shading
- 可加 fresnel reflection、wave normal map、岸边湿地泥色过渡

### 4. 海洋 (ocean)
**入口**：`src/game/terrain/oceanRenderer.ts`

- 现在 Y=-3 的简单平面 + ripple shader
- 可加：海岸浅水色带（按深度 fade）、波浪 shader、sun glint

### 5. 天空 (sky) + 大气
**入口**：`src/game/atmosphereLayer.ts`、`src/game/skyDome.ts`、`src/game/celestial.ts`

- 已有日出/日落渐变 — 可加 horizon haze、银河密度、晚霞分层
- 月亮 disc 大小、星座准确度（北极星附近，黄道带）
- 不同纬度看到的天空差异

### 6. 云 (clouds)
**入口**：`src/game/cloudPlanes.ts`、`src/game/skeletal/flightVisuals.ts`（筋斗云）

- 天空云：现在 procedural plane texture
- 可试：中国画"留白""卷舒"风格云、3D 体积感（fake billboards）
- 筋斗云：sprite 堆叠，现在已根据时刻 tint

### 7. 环境光照 (lighting)
**入口**：`src/pyramid-demo.ts` 181-189 行；`src/game/pyramidEnvironmentRuntime.ts`

- 4 灯：ambient / sun / moon / rim
- 可 tune：不同时辰色温曲线、季节调色（春暖橙 / 冬冷蓝）、天气衰减
- 看 `applyPyramidEnvironmentRuntime` 内每个 visual channel 的 lerp 方式

### 8. 角色 / 坐骑视觉
**入口**：`src/game/player/characterRuntime.ts`、`src/game/skeletal/flightVisuals.ts`

- 已修了 Meshy AI 的塑料感（matte PBR + emissive=0.2）
- 可优化：rim light 加描边感、shadow casting（现在没投影）、衣物 cloth sim 暗示

### 9. POI 标签
**入口**：`src/game/textLabel.ts`、`src/data/poiRegistry.generated.ts`

- 现在 sprite text labels
- 可加：中国书法字体、距离 fade、occlusion check

---

## 测试 & 提交规范

任何视觉改动后**必跑**：

```bash
npm run test:fast              # 200ms 契约测试（~128 case）
npm run regression:baseline    # 19 case 几何 / 物理契约
npx tsc --noEmit               # TS 类型干净
```

跑全套：
```bash
npm test                       # 502 case ~38s
```

### 工作流

```bash
git checkout -b style/<topic>      # 比如 style/atmospheric-perspective
# 改代码 + 自测
git add -p                          # 选择性 stage
git commit -m "feat(sky): atmospheric perspective via exp fog + sky tint"
git push -u origin style/<topic>
```

GitHub 上看 PR（或直接 push 到 main 那就别开 PR 了）。

---

## 文档地图

- `CLAUDE.md` — 项目约定 + 编码规范（**先读这个**）
- `todo.md` — 当前开发进度（7-step refactor 计划）
- `docs/02-architecture/` — 架构总览
- `docs/04-rendering/visual-style-and-performance-budget.md` — 视觉风格 + 性能基准
- `docs/05-epoch/` — 唐代 epoch 设定 + POI 史料考证
- `docs/superpowers/specs/2026-05-15-control-scheme-redesign-design.md` — 最近一次控制方案重构的设计文档

---

## 性能基准 + 已知瓶颈

- 目标：M1 Mac dev mode ≥ 60 FPS
- 已知瓶颈：
  - HUD minimap Canvas2D 重绘 12ms / 次（已限流 0.5s/次，但仍有阻塞）
  - 远景树木还是完整 LOD mesh，可换 billboard imposter
  - Chunk-based 树 InstancedMesh 没按 chunk 分组，无法 wholesale `.visible = false` 剔除

详见 `docs/04-rendering/visual-style-and-performance-budget.md`。

---

## 数据情况

- `public/data/dem/`（339 MB）— 地形高度，已进 git
- `public/data/rivers/`（44 MB）— 河流路径，已进 git
- `public/data/lakes/`、`china/` — 小数据，已进 git
- `public/models/skeletal/`（26 MB）— 人物 + 剑 GLB，已进 git

clone 后什么都不用做，直接 `npm run dev` 即可。

---

## 联系

代码里看不懂的随时问。`CLAUDE.md` 是项目约束的 SSOT，先扫一眼。
