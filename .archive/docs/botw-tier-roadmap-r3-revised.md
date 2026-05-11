# BotW-Like 视觉路线图 · r3 修订版

更新时间：2026-05-10
基于：Codex r3 critique（`/tmp/codex-r3-final.md`） + Claude r3 反思 + Claude 工程补强 10 条
路线选择：**Tier 2 主力路线**，Tier 1 作为 fallback，Tier 3（CSM 4-cascade + 完整反射）**取消**。

---

## 0. 前置认知 — 这份 plan 跟前几轮的差异

| 对比维度 | 旧 Tier 2 plan（5/9 草稿） | 本修订版 |
|---|---|---|
| 阶段数 | 5（Phase 1-5） | 5（Phase 0-4），含 1 个新前置 + 1 个新尾段 |
| 总工程量 | 10-12 天 + 12-15 天可选骨骼 | **12-16 天**（无可选骨骼） |
| 真骨骼角色 | Phase 4，12-15 天 optional | **删除**（Codex 实测 15-25 天起，含 IK 25-35 天，非 BotW 视觉路径必需） |
| Light probes | 必做项 | **降级**为 hemisphere tint / 分区 cubemap |
| Tier 3 极致 | Phase 5（CSM 4-cascade + 完整反射） | **取消**（Codex 判 shadow pass draw ×3-4，cost 不值） |
| 草风传导 | Phase 1 必做 | **延后**到 Phase 4（前提：先解 `HIDE_ALL_VEGETATION`） |
| HUD 12ms 热点 | 未提及 | **Phase 0 第一项** |
| WindManager 全局 | 未提及 | **Phase 0 必做基础设施** |
| 帧时稳定 | 未提及 | **Phase 4 主轴** |
| 用户感知 KPI | "65-75% BotW" | 替换为 visual feature checklist + frame stability metric |

---

## 1. Baseline 校准（开工前必跑）

旧 plan 写"现有 terrain+sky+bloom ~8ms" 跟 `docs/performance-baseline.md` 实测对不上。开工前先重测：

| 模式 | 现实测 (M-series Mac, dev) | 红线 (prod build) |
|---|---|---|
| Default follow camera | 0.39 ms / 120fps | ≥ 60fps |
| Overview camera | 12-13 ms / 47-50fps（HUD 占 12ms） | ≥ 30fps |
| Atlas fullscreen | 12-13 ms / 47-50fps | redraw frame ≤ 8ms |

**Phase 0 第 1 项必须把 HUD 12ms 砍到 ≤ 2ms**，否则 Phase 3 +5-6ms 加上去 overview 直接死 25fps。

设备 baseline 锁定为：**M-series Mac, prod build, 1440×900, pixelRatio 1.25, follow camera**。Win 集显作 best-effort，不当红线。Tier 1 是为 M1 Air 准备的 fallback preset，不是为 Win 集显。

---

## 2. 路线图

### Phase 0 — 前置基础设施（2 天）

**目的**：在加任何视觉特性前，先把 frame budget 释放出来 + 建立共享 uniform 总线 + 接入热路径。

| 子任务 | 工作量 | 来源 |
|---|---|---|
| **HUD mini-map 节流 0.15s → 0.5s** + features-cache（atlasFeatures changed 才重画） | 0.5 天 | `performance-baseline.md` 5.1 |
| **`EnvironmentUniforms` / `WindManager`** 全局：`{ direction, strength, gust, time, noiseScale }`，材质注册共享 uniform 引用 | 0.5 天 | Codex r3 #6 |
| **Baseline 重测** + 写入 `performance-baseline.md` Tier-2 baseline 段 | 0.25 天 | Claude 补强 #1 |
| **Shader pre-warm pass**：首屏前 invisible quad 触发新材质编译，避免首次激活 hitch | 0.5 天 | Claude 补强 #4 |
| **`castShadow` / `receiveShadow` 标位规划**：列出 Phase 3 CSM 要投影的对象白名单（avatar / 近景城墙 / 部分 scenery / 玩家附近 chunk terrain）写到一个 const 表 | 0.25 天 | Codex r3 #2 |

**预算影响**：HUD -10ms（overview 模式），其他项 ≈ 0ms。Phase 0 完成后 overview frame budget 才算"宽到能加东西"。

---

### Phase 1 — 视觉风格转换（3 天）

**目的**：cel-shading + rim + AO 烘焙 + 雷电闪光，画面立刻 BotW 风。

| 子任务 | 实施细节 |
|---|---|
| **Cel-shading shader injection** | `MeshPhongMaterial.onBeforeCompile`，**不切 PBR**（Codex r3 #5）。两段 quantize：lighting NdotL 量化 + base color 量化。**跟 `colorGradeShader` 共存**：cel 在 fragment shader 内做，split-tone 仍在 post-process 端做 |
| **Rim light** | 同 onBeforeCompile，camera-space normal dot view 反向，加 0.05 强度（Codex r3 #5 隐含） |
| **顶点 AO 烘焙** | build script 生成时一次性算每 vertex 的 ambient occlusion，写进 chunk JSON 的 vertex color alpha 通道。runtime 0 cost |
| **雷电闪光** | 雨天事件触发，单帧拉高 ambient + sun intensity 然后衰减。无新 shader |
| ~~**草随风 + 玩家压草**~~ | **不做**。前提是 `HIDE_ALL_VEGETATION = false`（当前是 true），等植被解封后挪到 Phase 4 |

**预算影响**：cel + rim + AO ≈ +0.3ms。雷电 0ms。**Phase 1 总开销 ≈ +0.3ms**（旧 plan 写 +0.5ms，含草风的部分；新版无草风）。

**接管语义**（旧 plan 没回答 → Codex r4 一定要问）：
- `colorGradeShader` 保留，仍跑在 OutputPass 之前
- `terrainShaderEnhancer` 的 biome 染色保留，cel quantize 在它之后
- `atmosphereLayer` 自定义 sky shader 保留，rim light 不影响 sky pass

---

### Phase 2 — 天气与水（3 天）

**目的**：layered cloud planes + 水面波纹 + sprite contact shadow + 简单平面反射（仅天空）。

| 子任务 | 实施细节 |
|---|---|
| **Layered cloud planes（伪体积）** | 3-5 个透明 plane + noise texture + 共享 `WindManager.direction` drift。**禁止文档出现 "volumetric cloud"** —— Codex r3 #3 明确反对 raymarch |
| **云投影地面** | sky-side cubemap 的 alpha 通道 → 地面 lambert 减光（不是真 shadow pass，是材质里的 modulation）|
| **水面波纹** | 现有 water mesh 加 vertex shader sin wave + normal map perturb，UV scroll 接 `WindManager.time` |
| **简单平面反射（仅天空）** | reflection camera 视锥裁到玩家附近 ~3 chunks，**只渲 sky dome + 远山 silhouette**，不渲 chunks/scenery（Codex r3 #2 隐含的"双倍渲染太贵"） |
| **Sprite contact shadow** | avatar + mount 脚下 1 个 alpha sprite，朝下投影。不用 stencil disc。Codex r3 round 2 选择已确认 |

**预算影响**：clouds +0.5ms / 水波 +0.2ms / 反射（裁过的）+1ms / sprite shadow +0.5ms = **+2.2ms**（旧 plan 写 +3ms，新版反射 cost 因视锥裁过而下降）。

---

### Phase 3 — 光照增强（3-4 天）

**目的**：CSM（克制版）+ god rays（screen-space radial blur）。

| 子任务 | Codex 钉死的实施约束 |
|---|---|
| **CSM 1-2 cascade** | shadowMap size **1024 或 1536**（不要 2048）。far 分别 ~80u / ~250u。`shadow.bias = -0.0005`，`normalBias = 0.02` |
| **`castShadow` 白名单** | avatar + 近景城墙 instanced（仅玩家所在 chunk + 8 邻 chunk）+ 名胜 scenic mesh。**树/草/远 chunk terrain 不投** |
| **`receiveShadow` 名单** | 玩家所在 chunk + 8 邻 chunk 的 terrain mesh。其余 chunks 不接 shadow |
| **shadow camera fitting** | 跟 follow camera frustum 同步，不要静态固定 far=800（Codex r3 #2 警告 "抖动/漏影/分辨率糊"） |
| **God rays** | **screen-space radial blur from sun screen pos**，4 pass，half-res RT。**不用 raymarch，不用 baked sprite**。太阳出屏时整 pass skip |

**预算影响**：CSM 2-cascade（restricted 名单）+2.5-3ms / god rays SS-radial +1.5-2ms = **+4-5ms**（旧 plan 写 +5-6ms，新版因 cascade 投影对象大幅缩减而略低）。

**Frame budget 累计校验**（M-series Mac，prod build，follow camera）：
```
0.39ms (Phase 0 baseline 重测后预期，HUD 已被 Phase 0 改造)
+ 0.3ms (Phase 1)
+ 2.2ms (Phase 2)
+ 4.5ms (Phase 3)
≈ 7.4ms / 16.7ms = 55% 占用，预算 OK
```
overview 模式（HUD 已优化到 2ms）：
```
2ms (HUD post Phase 0)
+ 0.3 + 2.2 + 4.5 = 9ms 总占用 / 33ms (30fps 红线) = 27% 占用，远在红线内
```

---

### Phase 4 — Frame Stability + Atmospheric LOD + Readability（4 天）

**目的**：吸收 Codex r3 第 8 题点出的"BotW 隐藏项"，这是 BotW 跟普通 cel-shading 游戏的真正分野。**这 8 项一项都不在旧 Tier 2 plan 里**。

| 子项 | 实施 |
|---|---|
| **稳定帧时间** | frame pacing：`requestAnimationFrame` + 16.6ms budget cap，超 budget 的 mini-map / scenery rebuild 推到下一帧。目标：99% percentile ≤ 18ms（不是平均 60fps）|
| **距离雾 + LOD 色彩统一** | terrain / scenery / cloud 的"远处颜色"用同一个 atmospheric `farColor` uniform，避免 LOD 边界色带 |
| **POI silhouette** | 名胜/关隘/城墙在 backlight 角度时 rim-light 加倍，剪影读得清 |
| **地形可读性路径引导** | 古道 ribbon 在玩家走偏时短暂高亮 0.5s，提示"应在路上"|
| **天气驱动 gameplay 反馈** | 雨天移动速度 ×0.95，雪天 ×0.9（已有 weather state）；雷电时 ambient flash 同步（已在 Phase 1）|
| **交互音画反馈** | 玩家踩水 / 上 mount / 切季节，瞬时音效 + 一帧 ambient flash |
| **材质边缘磨损/色带** | 城墙 instanced material 的 edge factor 加微噪声，避免完美直线 |
| **相机构图与地平线管理** | overview 模式相机 pitch 限制不让地平线掉出屏幕；玩家进入山谷时镜头自动微抬，避免视线被压死 |
| **草风传导 + 玩家压草**（前提：先 `HIDE_ALL_VEGETATION = false`） | 移到这里，因 Codex r3 #1 警告"在隐藏期间做风草是补基础设施" |

**预算影响**：大部分 ≈ 0ms（gameplay 逻辑 + uniform 共享）。**Phase 4 总开销 ≈ +0.5ms**。

---

## 3. 删除项 / 替代项总表

| 想做的 | 删除原因 | 替代方案 |
|---|---|---|
| 真骨骼 SkinnedMesh（Phase 4 / R） | Codex 实测 15-25 天起，含 IK/装备 25-35 天，非 BotW 视觉路径必需 | 保留现有 primitive avatar + sin/cos 腿动画。如未来需要，独立立项 |
| CSM 4-cascade（Tier 3 / Phase 5） | shadow pass draw ×3-4，cost 不值 | Phase 3 的 1-2 cascade restricted 已够 |
| 完整平面反射（含 chunks/scenery） | 双倍渲染 +6-8ms，cost 不值 | Phase 2 的"仅天空 + 远山" reflection 已够 |
| Light probes 自研烘焙 | 工具链成本不值，户外 80% 效果可代替 | hemisphere tint（sun/sky 双色 ambient）+ 分区 cubemap envMap |
| MeshPhysicalMaterial / PBR 切换 | 引入贴图/环境光/粗糙度一致性债务，stylized 风易"塑料" | 保留 MeshPhong + onBeforeCompile cel/rim 注入 |
| 真 volumetric cloud / fog raymarch | 浏览器 WebGL2 死刑（+30-60ms） | layered planes（已在 Phase 2） + 现有 height fog |
| 50000 粒子沙暴 | +20ms 死刑 | ≤ 5000 粒子 + 视距 cull |
| 真实时 GI / VXGI / Lumen | 浏览器死刑 | hemisphere tint 替代 |

---

## 4. Quality Tier preset

最终保留 **Tier 1 / Tier 2 二档**（删 Tier 3）：

| Preset | 目标 | 配置 |
|---|---|---|
| **Tier 1** (M1 Air / 旧 Mac, fallback) | 30-45fps 可接受 | Phase 1 + Phase 4 only。无 CSM、无 god rays、无 layered cloud（用现有 7 个 sprite cloud puff）、无 sky reflection |
| **Tier 2** (M2/M3 主力) | 60fps 守稳 | Phase 0/1/2/3/4 全开。CSM 2-cascade restricted、god rays SS、layered clouds、sky-only reflection |

**切换方式**：`localStorage.QUALITY_TIER = "1" \| "2"`，开发期手动切；上线再考虑 device-detect。

---

## 5. Fallback 决策树

如果 Phase 3 实测 +6ms（超 +5ms 预算）：
1. 先把 god rays full-res → quarter-res（省 1ms），看 frame OK 否
2. 仍超预算 → CSM 降到 1-cascade only（仅 avatar + 近景城墙），省 1.5ms
3. 仍超 → god rays 整个 disable，god rays 降级为 sun disc bloom 加强
4. 仍超 → Tier 2 该 instance 标为不达标，降级走 Tier 1

如果 overview frame ≤ 30fps 红线被破：
1. 先回滚 Phase 0 HUD 优化是否真的生效（cache 命中率？）
2. 看是不是 mini-map redraw 又被某处触发
3. 最后才考虑砍 Phase 2 的反射

---

## 6. 验收协议（每 Phase 末必跑）

直接复用 `todo.md` 末尾"跨 phase 流程约定"：

1. commit Phase 改动
2. `npm test` + `npm run build` 必须通过
3. Playwright 多角度截图前后对比，附进 commit
4. `/codex review` 复核
5. 性能验证：M-series Mac prod build，default-follow ≥ 60fps，overview ≥ 30fps，frame 99 percentile ≤ 18ms（Phase 4 引入后）
6. **Atlas 同步检查**（`feedback_atlas_3d_sync.md` 红线）：3D 加新东西必须同步到 atlas，截图前后对比

---

## 7. 时间表

| 阶段 | 工程量 | 累计 |
|---|---|---|
| Phase 0 前置 | 2 天 | 2 |
| Phase 1 cel/rim/AO/雷电 | 3 天 | 5 |
| Phase 2 cloud/水/反射/sprite shadow | 3 天 | 8 |
| Phase 3 CSM/god rays | 3-4 天 | 11-12 |
| Phase 4 frame stability + readability | 4 天 | **15-16** |

旧 plan 10-12 天，新版 **15-16 天** —— 涨在 Phase 0（前置 2 天）+ Phase 4（4 天）。但 Phase 4 是 Codex r3 第 8 题指出的"BotW 真正分野"，砍了等于做出来还不像 BotW。

---

## 8. 给 Codex r4 的核心问题（待 brief）

下一轮 Codex review 应该问：

1. Phase 0 的 HUD 节流到 0.5s 是否会被用户感知？还有更激进路径（mini-map → WebGL）？
2. WindManager 的 uniform 跨 ShaderMaterial 注册机制最佳实践？三方包还是手写？
3. CSM 的 `castShadow` 白名单粒度（per-mesh vs per-chunk）哪个 cost-perf 更好？
4. Phase 4 frame pacing 用 `requestAnimationFrame` budget cap 还是 `requestIdleCallback` 推迟？
5. Phase 1 cel-shading 的 `MeshPhongMaterial.onBeforeCompile` 跟 `colorGradeShader` 同时跑会不会有 quantization band 累积？
6. Light probes 替代 hemisphere tint，对夜间 / 阴影区是不是太暗？需要 fallback 机制？
7. Phase 4 "POI silhouette" 用 stencil pass 还是 rim factor 加倍，性能怎么对比？
8. 真骨骼角色已删，但 BotW 的"角色立体感"中有多少能用 vertex normal trick + flat shading 模拟？

---

附：
- Codex r3 raw critique：`/tmp/codex-r3-final.md`
- Codex r3 完整 trace：`/tmp/codex-r3-restart.log`
- 上一轮（r2 v2）brief：`/tmp/codex-r2-v2.md`
- 性能 baseline：`docs/performance-baseline.md`
- 视觉风格原则：`docs/visual-style-and-performance-budget.md`
