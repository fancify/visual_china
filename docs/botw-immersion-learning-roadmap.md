# 山河中国 · BotW 沉浸感技术学习与移植路线图

更新时间：2026-05-10
版本：**v2.2**（v2.1 + Codex r6 文档纠偏：1.4.7 BotW 真实性标签 + Phase 6 12 区任务表 + Phase 4 fallback 决策树 + LOD 边界规则 + 6.1/6.2 编号修正）
前身：`botw-tier-roadmap-r3-revised.md`（已废弃，原因：把 cel-shading 当主线，漏掉了用户最痛的"远景塌方 / 穿模 / 浮空"沉浸感破裂问题）

## ⚠️ 重要 framing 校准（吸收 r4 critique）

**BotW 真实技术细节大部分未公开**。GDC talks（"Change and Constant"等）只透露 art process / design philosophy，**没有公开** geomorph、depth foam、cloud cookie 的具体实现。本文档原 v1 把"合理开放世界技法"写成"BotW 确认技法"，r4 已纠正。

v2 起，所有"BotW 怎么解"表的内容**降级为 "BotW-inspired"**，并按三栏区分（每个技术细节请按此 mental model 读）：

| 栏位 | 含义 | 出处 |
|---|---|---|
| **公开确认** | GDC talks / Digital Foundry 拆解 / modding 社区有据 | 标 `[公开]` |
| **强推测** | 业界开放世界主流做法 + 视觉效果反推 | 标 `[推测]` |
| **浏览器替代** | 我们在 WebGL2 里能做的版本（可能跟 BotW 实现完全不同） | 标 `[替代]` |

**ms 数字也都是估算**，r4 评为"拍脑袋"。Phase 实施时必须实测校准。

---

## 0. 这份文档的形态跟之前不同

**这不是 implementation roadmap，是 learning + adaptation roadmap。**

每个痛点的处理结构是：

```
痛点（具体可观察现象）
  ↓
BotW 怎么解（技术名 + 原理 + 在 Switch ~400 GFLOPS 上的开销）
  ↓
浏览器 WebGL2 适配方案（具体怎么做 + frame ms 估算 + 降级点）
  ↓
"我们能做到 BotW 的几成" + 学习产出
```

**核心认知**：BotW 跑在 Tegra X1（~400 GFLOPS，4GB 共享内存）这种弱硬件上。M-series Mac 在浏览器里 WebGL2 受限再多，理论算力也比 Switch 强 5-10×。**如果我们做不到 BotW 的沉浸感，根因是不知道 BotW 的 trick，不是硬件不够**。这是一个学习驱动的问题。

Codex review 的价值是 **补充/纠正我对 BotW 真实技术细节的理解**，不只是评 ms 数字。

---

## 0.5 本轮范围声明（重要，2026-05-10 用户钉死）

**本轮要做的**：
- **景色本身的真实 / 美丽 / 沉浸 / 无 bug**
- 玩家在天地间闲逛畅游，**靠景色本身的美震慑人**
- 玩家 verbs 仅 3 个：**走路、爬山、高处飞翔鸟瞰**

**本轮明确不做**（虽然有价值，但归后续阶段）：
- 游戏设计层 — wow moments / reveal scripts / Atlas 渐进解锁 / 季节作为 gameplay 约束 / 散落环境叙事 / micro-discovery 累积循环
- 物理特效 — 流水冲走玩家 / 入水 splash particle / 物体漂浮 / 物理碰撞反馈
- 互动反馈 — 路径引导高亮 / POI silhouette 强化 / 触发音画反馈

**判断标准**：如果某个特性是为了"让玩家做某件事/感受某种 gameplay"，归后续；如果是为了"让玩家闲逛时看到的世界更真更美"，归本轮。

这意味着 1.5 节（BotW 体验精髓 8 项）整节降级为"后续阶段，本轮不实施"，但保留作为路线参考。Phase 6/7 删除。

---

## 1. 痛点 → BotW 解法 → 浏览器适配（核心表）

### 1.1 远景塌方（"近看 OK，远看立刻大方块，零缓冲零层次"）

**这是用户最痛的一项。**

#### BotW 怎么解（综合 GDC talks / Digital Foundry 拆解 / 玩家 modding 社区）

| BotW 技术 | 原理 | Switch 开销估 |
|---|---|---|
| **多档地形 LOD with morphing** `[公开]` | 远地形按距离分 4-5 档 mesh 精度。相邻档切换时做距离窗口内的 height blend（avoid pop），玩家无感知 | ~1.0ms（顶点 shader 端） |
| **Distance-driven object impostor** `[推测]` | 树/草：近 full mesh，中距离 billboard，远 sprite。**impostor 在 atlas 上预烘**，runtime 0 重建。BotW 具体用 cross-quad / multi-angle / dither fade 哪种未公开 | ~0.5ms |
| **大气透视 (aerial perspective)** `[公开]` | fragment shader 末端按 view-space depth 把颜色向 sky color lerp。距离越远、湿度越高，远景越"溶化"进天空 | ~0.3ms |
| **云影 (cloud shadow on terrain)** `[推测]` | 大尺度 2D cloud cookie texture 沿风向 scroll，**world-space** 投到地表 fragment 的 ambient/diffuse modulation。**视觉效果是动态的、连续的**，分散玩家对 LOD 边界的注意 | ~0.4ms |
| **Volumetric haze in valleys** `[推测]` | 山谷低洼处加一层雾，远山被山谷雾"切割"成层次 | ~0.6ms |
| **Sky-driven distant 山 silhouette** `[推测]` | 极远处的山只画 silhouette + 单色填充，跟 sky color 渐变 | ~0.2ms |

BotW 远景沉浸感的关键不是"远景画得真"，是 **"远景的退化被多层视觉手段同时掩盖"**：geomorphing 消除几何切换、大气透视消除色彩切换、云投影分散注意力、远山 silhouette 给暗示。**单一手段不够，必须组合**。

#### 浏览器适配方案

| 我们做什么 | 实施细节 | 预算 |
|---|---|---|
| **4 档同心环 LOD geomorphing** `[替代]` | L0 (0-50u) full mesh / L1 (50-150u) 5km downsample / L2 (150-400u) 10km downsample / L3 (>400u) 28km silhouette。**v2 校正**：切换边界 ±10u 内做 height blend，**vertex shader 端读 2 个 height attribute/texture 做 uniform-driven lerp**（不是 r4 纠正前的"CPU 改 BufferAttribute"——那个写法是 GPU upload 灾难） | +1.5ms |
| **Distance impostor (scenery)** `[替代]` | 树/scenic 近 full mesh，>50u 起切 impostor。**v2 校正**：用**多角度 impostor atlas + dither fade**（不是单纯 4-quad billboard，r4 警告会有"风车感"）。草 atlas 跟树 atlas 不要复用 | +0.5ms |
| **Atmospheric haze 强化** `[替代]` | terrain shader 末端按 view depth 向 `atmosphericFarColor` uniform lerp。远景 + 云 + 山共用同一个 farColor | +0.3ms |
| **云影到地表** `[替代]` | **v2 校正**：用 **world-space 2D cloud cookie texture**（不是 r4 纠正前的"sky cubemap alpha"），按 WindManager.direction scroll，地表 fragment shader 按 worldX/worldZ 采 cookie，作为 ambient/diffuse modulation | +0.4ms |
| **远山 silhouette pass** `[替代]` | L3 档地形不用 height 染色，用 sky-tinted flat color，跟 atmosphericFarColor 渐变 | 0 (跟 L3 同 pass) |
| ~~山谷雾~~ | 移到 Phase 6 (世界呼吸 - 山间雾) | - |

**总预算**：+2.7ms（Phase 0 LOD 部分）

**降级点**：极远 (>800u) 不做 geomorph，直接 L3 silhouette LOD。低端设备 (Tier 1) 砍 L2 档，只 L0 / L1 / L3。

**预期效果**：BotW 远景沉浸感 70-80% 复刻。差距主要在云投影的精细度（BotW 是真烘焙 cloud cookie，我们是 sky cubemap modulation）。

#### 4 档 LOD 边界 morph 规则（r6 关键盲点 — 实施前必读）

r6 警告：v2.1 缺 chunk 边界 morph 规则。LOD ring 切换处会有 4 类问题，必须有明确策略：

**1. 相邻 LOD 裂缝处理（T-junction）**
- 问题：L0/L1 边界，高分辨率 vertex 数 > 低分辨率，T-junction 会出现高度不连续的细黑缝
- 方案：L1 相邻 L0 的边界 vertex 强制对齐 L0 同位置 vertex 的 height (通过 height texture 边界 sample)
- 反模式：直接生成两个独立 mesh 互相邻接 → 视觉裂缝必出

**2. height texture 对齐**
- L0/L1/L2/L3 的 height texture 必须共享同一 worldXZ 坐标系
- 在 LOD 切换过渡区（譬如 50u-60u for L0/L1），fragment shader 同时采 L0 和 L1 两张 height texture，按距离 lerp blend
- chunk 边界 vertex 的两套 sampler 结果必须一致（用 nearest texel 而非 linear filtered，避免边界 sampling 偏差）

**3. fallback 到 base sampler 的视觉策略**
- 玩家走出已 chunk-load 的范围时（chunk streaming 还没赶上），LOD ring 退化到 base sampler
- base sampler 是 L1 整张图，分辨率不够近距离 detail
- 视觉策略：base sampler 期间 atmospheric haze 强化 (远景化)，掩盖几何粗糙感
- 不要直接显示 base sampler 的低精度 mesh，会显得"突然变远了"

**4. geomorph 时机**
- vertex shader uniform `uMorph` 由 CPU 端按 (camera distance / chunk center distance) 算
- morph 区间宽度 = 距离环宽度 × 0.2 (譬如 L0/L1 切换在 50-150u 之间，morph 区间 50-70u 做 lerp)
- camera 拉远时 uMorph 0→1 把 vertex y 从 L0 高度 lerp 到 L1 高度
- camera 拉近时反向

**实施前 PoC**：先在秦岭一个 chunk 单独跑两档 LOD geomorph (L0 + L1 only)，Playwright 截 camera 拉远的连续 6 帧，确认裂缝 = 0、过渡平滑。再扩到 4 档。

#### 学习产出
- `docs/learning/botw-distance-fade.md` — 记录 geomorphing 的 vertex shader 实现 + T-junction 解 + 云影 cookie 数学
- 测试样本：在秦岭区域跑 Playwright，相机从 50u 拉到 500u，截 6 帧对比 LOD 切换是否 smooth

---

### 1.2 水浮空 / 死硬片 / 走势不自然

#### BotW 怎么解

| BotW 技术 | 原理 | Switch 开销估 |
|---|---|---|
| **水面 = 烘焙到地形 heightmap 的 mask + runtime mesh** | 水的位置/形状是 build-time 烘焙的（heightmap 上有 water mask 通道），runtime 按 mask 生成 vertex 跟随地形。**水永远不"浮在地形上"** | 0 (build-time) |
| **水面波纹 = vertex shader 双层 sin + normal map perturb** | 两层不同频率/相位的 sin wave 叠加 + scrolling normal map。零真物理 | +0.2ms |
| **水边互动 = depth-based foam ring** | 水 fragment shader 采样 depth buffer，水深 < threshold 处加白色 foam。**不需要 detect 边界**，靠 depth 自动出 foam | +0.3ms |
| **入水 splash = particle burst + ripple decal** | entity y 速度 < threshold 时触发 splash particle，地面贴 ripple decal | <0.1ms |
| **流水方向 = vertex shader UV scroll along path** | 河水按预烘 path direction texture，UV 沿方向 scroll。**视觉上看起来"在流"**，零物理 | +0.1ms |
| **水深染色 = depth → blue gradient** | 浅水 turquoise，深水 navy。fragment 按 view depth 采样 gradient texture | +0.1ms |

**BotW 水的灵魂**：**几何上跟地形烘焙在一起**（不浮空、不穿模），视觉上是 vertex shader + normal map + depth foam 的组合（不真物理）。

#### 浏览器适配方案

| 我们做什么 | 实施细节 | 预算 |
|---|---|---|
| **build script 雕河进 chunk heightmap** | 当前 build 已经有 hydrography mask；新增逻辑：mask > 0.4 的 cell 把高度雕低 0.7u。river ribbon 保留做近景 vertex 波纹，但不再是悬浮 mesh | 0 (build-time) |
| **水 mesh 跟随 chunk heightmap** | runtime 不再用单独 water plane，而是从雕过的 chunk geometry 提取 water mask 区域，复用 vertex 位置。**水永远贴着地形** | +0.2ms |
| **vertex shader 双层 sin + normal map** | 现有 water mesh 加 sin/cos perturb + scroll normal map | +0.3ms |
| **Depth foam ring** `[替代]` | water fragment shader 采样 depth buffer，水深 < 0.05 处加 foam。**v2 警告（r4）**：Three.js `WebGLRenderTarget` with depthTexture 跟 EffectComposer 共存，但要自定义 RT / Pass 顺序。透明水的 depth 写入、MSAA 兼容是已知坑——必须先做 PoC 验证 | +0.4ms |
| **入水 splash particle** | mount/avatar Y 速度 < -2 时触发 ParticleSystem burst（5-8 个 sprite quad）+ 地面贴 ripple decal | <0.1ms |
| **流水方向 UV scroll** | river ribbon vertex shader 按 path direction UV scroll，path direction 在 build 时烘到 vertex attribute | +0.1ms |
| **水深染色** | 现有 vertex color 已经按高度染过；改成按 view depth → blue gradient texture sample | +0.1ms |

**总预算**：+1.2ms（水部分全做）

**预期效果**：BotW 水的沉浸感 75-85% 复刻。**几何契约 100% 修复（不浮空不穿模）**，视觉上 depth foam 是关键，做了之后水才有"湿"感。

#### 学习产出
- `docs/learning/botw-water-tricks.md` — 雕河 build pipeline + depth foam 的 fragment shader 写法
- 测试样本：渭河/汉水/嘉陵江三条河，验证: ① 不浮空 ② 入水 splash ③ 边缘 foam ring

---

### 1.3 城市/古道穿模（"古道会从山体里穿过，城市穿模"）

#### BotW 怎么解

| BotW 技术 | 原理 | Switch 开销估 |
|---|---|---|
| **GroundAnchor 模式** | 所有"贴地"对象在编辑器里就 snap 到 heightmap，runtime 不重新 raycast。POI 位置在 build-time 烘 worldX/worldZ + height offset | 0 (build-time) |
| **路径 = per-vertex sampleHeight + offset** | 古道 / 路面 polyline 的每个 vertex 单独 sample 当前 chunk 的 heightmap，加 0.05u 偏移浮在表面。**关键**：是 per-vertex sample，不是整体 polygonOffset | <0.1ms |
| **城市基底 = "压平"该区域 chunk** | 城市占地区域的 chunk heightmap 在 build 时被强制 flatten 到城市 base height。**城市不"放在山上"，是把山压平后放城市** | 0 (build-time) |
| **大体积建筑用 collision proxy** | 大型建筑（城墙等）有简化 collision mesh，玩家/动物路径做 raycast，但视觉 mesh 跟 collision 分离 | <0.1ms |
| **chunk reanchor on stream-in** | chunk 加载时遍历所属 anchor 池，根据新 chunk heightmap 校准 y 位置 | <0.1ms |

**BotW 几何契约的灵魂**：**所有"贴地"对象的 y 位置在 content time 烘焙好**，runtime 不动态计算。Stream-in 时只做最小校准。

#### 浏览器适配方案

| 我们做什么 | 实施细节 | 预算 |
|---|---|---|
| **GroundAnchorRegistry 池** | 新增 `src/game/groundAnchors.ts`，所有 POI / 城墙 instance / route ribbon vertex / scenic mesh 注册 anchor: `{ object, baseOffset, worldX, worldZ }`。chunk load/unload 触发 `reanchor(chunkBounds)` 遍历池更新 position.y | <0.1ms |
| **路径 per-vertex sample** | 现有 route ribbon 改成每 vertex 单独调 `sampler.sampleSurfaceHeight(x, z)` + 0.05u offset。删掉 polygonOffset hack | +0.2ms (vertex 数 ~6000，每帧不重算，只 chunk 切换时重算) |
| **城市基底压平** | build script 对城市占地的 chunk cell 强制 flatten 到该城市 base height（取该区域中位数）。城墙 instance y 直接用 base height，不再 raycast | 0 (build-time) |
| **chunk reanchor 接 streaming** | chunk load 完成后调 `groundAnchorRegistry.reanchor(chunkBounds)` 一次 | <0.1ms |
| **`lastHitChunk` 缓存优化 sampleHeight** | `CompositeTerrainSampler.resolveChunk` 加 lastHitChunk 缓存：玩家慢速移动时命中率 ~95% (Codex r2 已 validate) | -0.5ms (从加路径 sample 中省回) |

**总预算**：+0ms（大部分 build-time + lastHitChunk 缓存把新增 sample 成本省回）

**预期效果**：穿模问题 95-100% 解决。剩余 5% 来自城市基底压平时边缘陡峭可能露出 seam，需 Codex r4 评估。

#### 学习产出
- `docs/learning/botw-ground-contract.md` — anchor registry 模式 + per-vertex path sample + chunk-flatten build pipeline
- 测试样本：古道穿秦岭 / 西安城外 / 汉中盆地，验证: ① 古道不穿山 ② 城墙不浮空 ③ chunk 切换时 POI 不闪烁

---

### 1.4 光照 / 树 / 草 / 风 / 雷电 / 夕阳 / 月亮 / 云雾"简陋落后"

这是大块，按子项拆。

#### 1.4.1 光照（"光照效果简陋"）

| BotW 技术 | 原理 | Switch 开销 |
|---|---|---|
| **Cel-shading via toon shader** | 光照 NdotL 量化为 2-3 档（亮/中/阴影），不是连续 gradient。base color 也轻度 quantize | <0.1ms |
| **Rim light** | view × normal 反向 → 边缘高光。强化角色 / 大型建筑剪影 | <0.1ms |
| **CSM (cascaded shadow map) 1-2 cascade restricted** | 只投 avatar + 近景大型建筑。远景靠 baked AO + cloud shadow modulation | +1.5ms |
| **Sky-driven ambient** | ambient 颜色由 time-of-day → sky palette table 决定，每帧 lerp。**ambient 是大头**，cel-shading 之所以好看是因为 ambient 颜色对 | <0.1ms |
| **Light probes (zone cubemap)** | 每个区域一个 envMap 预烘，物体按所在区域取 envMap 做 indirect | 0 (runtime) / build-time bake |
| **顶点 AO 烘焙** | build 时算每 vertex 的 ambient occlusion，写 vertex color alpha。山谷阴影自然出现 | 0 (runtime) |

**浏览器适配**：cel + rim 用 `MeshPhongMaterial.onBeforeCompile` 注入（不切 PBR）。CSM 用 1-2 cascade restricted（只 avatar + 近景城墙）。Light probes 降级为 hemisphere tint + 分区 cubemap。AO 烘焙到 vertex color。

**预算**：+2.5ms 总光照部分

#### 1.4.2 树 / 草

| BotW 技术 | 原理 | Switch 开销 |
|---|---|---|
| **草 = vertex shader sin wave + 全局 wind uniform** | 每个 grass blade vertex y > 0 时 x/z 按 sin(time + worldX*freq) 偏移。零物理 | +0.3ms (大量 instance) |
| **玩家压草** | grass shader 接 player.position uniform，半径 ~3u 内反向偏移 vertex | +0.1ms |
| **树叶 = billboard cluster + wind sway** | 树叶不是真 mesh，是 8-16 个 billboard quad cluster。整树按 wind 摇摆 | <0.1ms (instanced) |
| **远树 → cross-quad billboard** | >50u 距离切 cross-quad，atlas 预烘 | <0.1ms |
| **树根接地不浮空** | content-time 烘到 anchor 池，runtime 不浮 | 0 |

**浏览器适配**：先解 `HIDE_ALL_VEGETATION = true`，然后做草风 + 玩家压草 + 远树 impostor + anchor 池接管树根。

**预算**：+0.5ms 树/草部分

**前提**：必须先解封 `HIDE_ALL_VEGETATION`。当前关闭原因待查（perf？视觉？）

#### 1.4.3 风（"风的体验简陋"）

| BotW 技术 | 原理 |
|---|---|
| **全局 WindManager** | 单 uniform `{direction, strength, gust, time, noiseScale}`，所有需要风的系统（草、云、衣服、火焰）共享 |
| **风可视化 = 草倾向 + 落叶 trail + 飘云** | 玩家从草、落叶飘飞、云移动方向看到风 |
| **风影响 gameplay** | 滑翔时顺风加速，火焰按风扩散 |

**浏览器适配**：实现 `EnvironmentUniforms / WindManager` 全局，所有 shader 共享。落叶 trail 暂缓（Phase 4），飘云接 Phase 2 layered cloud。

**预算**：~0ms（基础设施）

#### 1.4.4 雷电（"雷电简陋"）

| BotW 技术 | 原理 |
|---|---|
| **闪光 = 单帧 ambient + sun intensity 拉到 5x，立刻衰减到 0.3x 0.2s** | 全屏白光感 |
| **闪电 mesh = 程序生成的 zigzag line strip with bloom** | 现场算，天空生成 |
| **雷声 = audio delay 按距离** | 闪电先，雷声延迟 0.5-3s |

**浏览器适配**：单帧 ambient/sun spike 已有现成 weather state。闪电 mesh 程序生成（zigzag + bloom 给我们的 EffectComposer 链做）。

**预算**：~0.1ms

#### 1.4.5 夕阳 / 月亮 / 月相

| BotW 技术 | 原理 |
|---|---|
| **太阳/月亮 = HDR sprite + bloom halo** | 自发光 sprite + UnrealBloom 自然出 halo |
| **月相 = fragment shader terminator** | 月相不是切贴图，是 fragment shader 按月-太阳 angle 算 terminator |
| **夕阳 sky palette** | sky shader 按 sun altitude 选 palette table（黎明/正午/黄昏/夜），lerp 切换 |

**浏览器适配**：太阳/月亮用 NASA 高分贴图（todo P1.5）+ bloom halo（已有 UnrealBloom）。月相 shader（todo P1.7）实现 terminator。Sky palette 重做按 sun altitude 选 palette。

**预算**：+0.2ms

#### 1.4.6 云雾（"云雾简陋"）

| BotW 技术 | 原理 |
|---|---|
| **天空云 = sky dome procedural noise** | sky shader 内 noise function 算云形状，按 wind scroll |
| **远景云 = layered planes (3-5 个)** | 不是真体积，是分层透明 plane + noise texture |
| **山谷雾 = volumetric ground fog** | 低海拔区按高度 → fog density，fragment shader 末端 lerp |
| **云投影 = cloud cookie** | 大尺度 noise texture 沿风向 scroll，作为地表 ambient modulation |

**浏览器适配**：替换现有 7 sprite cloud puffs 为 layered cloud planes (3-5 plane + noise + WindManager drift)。云投影到地表 lambert（1.1 已涵盖）。山谷雾 = height-based fog uniform。

**预算**：+0.8ms

#### 1.4 总预算

| 子项 | +ms |
|---|---|
| 光照 | +2.5 |
| 树/草 | +0.5 |
| 风 | 0 |
| 雷电 | +0.1 |
| 夕阳/月亮 | +0.2 |
| 云雾 | +0.8 |
| **小计** | **+4.1ms** |

#### 学习产出
- `docs/learning/botw-lighting-and-weather.md` — cel toon shader 数学 + cloud cookie 实现 + sky palette table

---

## 1.4.7 世界的呼吸 — 季节 / 时间 / 天气 / 动植物变化（沉浸感必要要素）

**用户钉死（2026-05-10）**：季节、时间、天气、动植物的变化都是沉浸感的**必要要素**，不是可选增强。世界必须看起来"在呼吸"，而不是一个静态布景。

**重要区分**：这不是 gameplay 约束（"雨天速度 ×0.85"），是**视觉与音频 fabric**。世界自己在变，玩家闲逛时被这种"活着的世界"包裹住。

> ⚠️ **r6 纠错（必读）**：BotW 公开可查证的部分 = 动态天气 / 雨雪雷暴 / 雨转雪 / 天气预报 / 昼夜 / 月亮 / 血月 / 萤火虫 / 动物生态系统。**BotW 没做的部分** = 4 季 cycle / 秋季落叶累积 / 春花系统 / 雪后累积 / 候鸟迁徙 / 雨后持久湿润。后者是**山河中国自创"世界呼吸"**，不是 BotW 借鉴。**实施时不要把它当 "BotW 学习目标"** — 当成自己创新就好，但要承认它没有 BotW 验证背书。
>
> 每条任务表加 `[公开]` (BotW 真实做)、`[部分]` (BotW 类似但不完全相同)、`[自创]` (山河中国自创，BotW 没做) 三档标签。

#### 季节变化（4 季 cycle，已有 20min/季 切换骨架 — **整个 4 季 cycle 是山河中国自创，BotW 没有**）

| 真实性 | 山河中国做什么 | 浏览器适配 | 当前差距 |
|---|---|---|---|
| `[自创]` | 地表色调按季节 lerp（春绿/夏深绿/秋黄红/冬枯白） | terrain shader 加 seasonalTint uniform，按 EnvironmentController.season lerp | ✅ 部分有，需强化色彩区分度 |
| `[自创]` | 植被颜色按季节变（樱花春开 / 枫叶秋红 / 冬枯枝） | scenery instanced material 接 seasonalTint uniform，按树种切换 | ❌ 当前所有树同色 |
| `[自创]` | 落叶飘飞（秋季） | 程序生成 leaf particle，按 WindManager 漂移，地面累积一层 | ❌ 没 |
| `[部分]` | 雪覆盖（冬季高海拔） | terrain shader 按 (season=winter) AND (elevation > threshold) 在 fragment shader 加 snow blend | ❌ 没 |
| `[自创]` | 水部分结冰（冬季） | water shader 按季节 + 海拔 切到 ice texture + 减反射 | ❌ 没 |
| `[自创]` | 桃李梨花点缀（春季） | scenery 春季在某些 chunk 增加 blossom particle / instance | ❌ 没 |

> BotW 备注：BotW 没有四季 cycle，只有时间和地区 biome 差异（高山雪域、沙漠、热带）。山河中国把"四季"当沉浸感主轴，是对中国"二十四节气" 文化的呼应，不是 BotW 模仿。

**预算**：seasonal tint shader +0ms（uniform 替换），落叶 / 雪盖 / 花朵 particle ≤+0.4ms

**工程量**：2 天

#### 时间变化（24h cycle，已有 sky palette 骨架）

| 真实性 | 山河中国做什么 | 浏览器适配 | 当前差距 |
|---|---|---|---|
| `[公开]` | 日出 / 日落更剧烈的 palette shift | sky shader 在 sun altitude 临界值（-5° 到 +15°）做 dramatic palette ramp | ⚠️ 当前过渡平淡 |
| `[公开]` | 山体边缘金边（晨昏 rim 强化） | rim shader uniform 接 sun altitude，晨昏时 rim strength ×3 | ❌ 没（依赖 Phase 2 cel + rim） |
| `[公开]` | 夏夜萤火虫 | 玩家附近 5-15u 范围生成飘动 sprite particle，仅夏季夜晚 | ❌ 没 |
| `[自创]` | 远城灯火点点（夜晚） | 城墙 instance 夜晚切到 emissive 黄光（已有部分）+ 远距离仍可见的小光点 | ⚠️ 当前夜晚城市偏暗 |
| `[公开]` | 月光照明（满月时增强）+ 月相 | moonLight 强度按月相调节，满月时 ambient ×1.5 | ❌ 当前固定（BotW 有 blood moon = 月相强化先例） |

**预算**：+0.2ms

**工程量**：1 天

#### 天气变化（已有部分骨架）

| 真实性 | 山河中国做什么 | 浏览器适配 | 当前差距 |
|---|---|---|---|
| `[公开]` | 天气状态间平滑 lerp（不硬切） | weather lerp over 8-15s，所有 uniform 同时插值 | ⚠️ 当前是 instant 切 |
| `[公开]` | 多云 / 阴天 variant | layered cloud planes 加密 + ambient 降饱和 | ❌ 没（todo 已列） |
| `[部分]` | 晨雾（早晨 5-7am 自动起雾） | volumetric height fog 早晨 density ×2，10am 散去 | ❌ 没 |
| `[公开]` | 山间雾（低洼区 + 早晨） | height-based fog uniform 在 elevation < threshold 区域加 density | ❌ 没 |
| `[自创]` | 雨后地面湿润 reflection（持续 30s） | 雨后 30s 内 terrain fragment 加 wetness factor | ❌ 没 |
| `[自创]` | 雪后雪盖累积（一段时间） | 雪天持续后地面 snow blend factor 渐增 | ❌ 没（BotW 雪只在 biome 区，不累积） |

**预算**：+0.5ms（多云 layered cloud 增量 + height fog + wetness）

**工程量**：2 天

#### 动植物变化（已有 wildlife 系统 — **季节性变化是山河中国自创，BotW 没做**）

| 真实性 | 山河中国做什么 | 浏览器适配 | 当前差距 |
|---|---|---|---|
| `[自创]` | 候鸟季节性迁徙（春北/秋南） | 春秋季节在天空生成飞鸟 V 字队列，按方向飞过 | ❌ 没 |
| `[自创]` | 季节性鸣叫（夏蝉鸣 / 秋虫鸣 / 冬寂静） | audio mixer 按季节切环境音 sample | ⚠️ 部分有，需强化 |
| `[自创]` | 动物季节 visibility（冬季罕见 / 春季活跃） | wildlife spawn rate 按季节调节 | ❌ 当前固定 |

> BotW 备注：BotW 动物 spawn 是天气敏感（雨天动物躲）+ 时间敏感（夜晚不同生物出现），不是季节敏感。山河中国把"候鸟" 等季节驱动元素加进来是为了体现"中国地理 + 二十四节气" 文化，自创延伸。

#### 地域 biome 多样性（用户钉死 2026-05-10：中国地域辽阔，不同位置动植物分布不同，至少代表性物种要齐）

**重要原则**：参考 `~/.claude/projects/.../memory/feedback_real_world_china_data.md` — 用户曾纠正 Claude 把"中国沙漠 = 仙人掌"的错误。**所有 fauna / flora 必须用真实中国物种**。

按地理分区落地代表性物种（当前秦岭切片 + 未来全国扩区）：

| 地理分区 | 代表 flora | 代表 fauna | 状态 |
|---|---|---|---|
| **秦岭山地**（当前主切片） | 太白红杉、华山松、巴山冷杉、连香树、独叶草 | **大熊猫**、金丝猴、羚牛、朱鹮、林麝 | ⚠️ 部分有，物种需精确化 |
| **关中平原**（当前主切片） | 麦田、白杨、国槐 | 麋鹿、寒鸦、灰雁、田鼠 | ⚠️ 缺特征物种 |
| **汉中盆地**（当前主切片） | 稻田、油菜花（春）、桑树 | 白鹭、水牛、棕背伯劳 | ❌ 缺 |
| **四川盆地**（当前主切片） | 翠竹、芭蕉、楠木、天府稻 | 大熊猫（盆地竹林边缘）、川金丝猴、白鹇 | ❌ 缺 |
| **青藏高原**（未来扩区） | 高原草甸、雪莲、龙胆、垫状植物 | 藏羚羊、雪豹、藏野驴、牦牛、黑颈鹤 | 后续 |
| **西北戈壁**（未来扩区） | 胡杨、梭梭、红柳、骆驼刺、沙拐枣 | 双峰驼、野驴、鹅喉羚、沙鼠、沙蜥 | 后续 |
| **黄土高原**（未来扩区） | 旱柳、沙棘、谷子、糜子 | 山鸡、苍鹰、山地黄羊 | 后续 |
| **江南水乡**（未来扩区） | 莲、菱、芦苇、水杉、香樟、油茶 | 白鹭、震旦鸦雀、扬子鳄、长江豚 | 后续 |
| **华北平原**（未来扩区） | 杨树、小麦、棉花 | 大雁、麋鹿（南海子）、灰鹤、华北豹 | 后续 |
| **东北森林**（未来扩区） | 红松、云杉、白桦、人参、灵芝 | 东北虎、丹顶鹤、马鹿、紫貂、东北棕熊 | 后续 |
| **华南热带**（未来扩区） | 椰子、棕榈、榕树、芒果、凤凰木 | 长尾猴、犀鸟、海南坡鹿、海南长臂猿 | 后续 |
| **云贵高原**（未来扩区） | 杜鹃、茶树、紫竹、银杏 | 黑叶猴、白颊噪鹛、滇金丝猴、绿孔雀 | 后续 |

**实施策略**：
- 每个 chunk 在 build pipeline 时根据其地理位置（lat / lon / 海拔）查 biome lookup table，确定该 chunk 的 flora / fauna 配方
- scenery / wildlife instancing 按 chunk 配方 spawn，不再全图通用
- 每个 chunk 至少有 3-5 个旗舰物种（不必全部 12+），保证地域可读性
- 数据存 `src/data/biomes.ts`，引用 IUCN / 中国植物志的真实分布

**预算**：+0.3ms（多样化 wildlife instanced 不增加 draw call 数，只增加 mesh 多样性）

**工程量**：3 天（其中 2 天数据收集 + 1 天 build pipeline biome lookup）

---

**1.4.7 总工程量：7 天**（独立 Phase 6 落地）

**1.4.7 总性能开销：+1.4ms**（季节 +0.4 / 时间 +0.2 / 天气 +0.5 / 动植物 +0.3）

**这一节的灵魂**：BotW Hyrule 之所以让人觉得"活着"，不是因为 cel-shading 漂亮，是因为它**在你不操作时仍然在变**。云在飘、草在摇、鸟在飞、季节在转、雨在下。山河中国必须有这种"自己在呼吸"的感觉，否则 cel-shading 再好也是个布景。

---

## 1.5（后续阶段，本轮不做）BotW 体验/玩法精髓 — 跟项目高度吻合、值得直接学的

> ⚠️ **本节降级为后续阶段，本轮不实施**。
>
> 用户 2026-05-10 钉死本轮范围（见 0.5 节）：本轮聚焦"景色本身的真实美丽沉浸"，不做游戏设计层。本节内容（视点驱动 atlas / scripted reveal / 散落环境叙事 / micro-discovery 累积 / 季节作为 gameplay 约束 / 飞行 reveal scripts）全部归入后续阶段。
>
> **保留这一节**作为路线参考，未来 Phase 6/7 阶段会基于此节展开。

**这一节不是修痛点，是借灵感。**

前面 1.1-1.4 是"修我们做差的地方"。这一节是 **"BotW 用什么做出来'哇塞'瞬间，我们怎么在山河中国的语境下也做出来"**。每一项都满足：
1. BotW 的标志性体验
2. 跟"山河中国"项目（中国地理 / 历史 / 探索）高度吻合
3. 在浏览器性能预算内可落地
4. 能让玩家产生"哇塞 / 我必须去看看 / 这真好" 的瞬间

### 1.5.1 "看到的都能去" — 视觉地标驱动探索动机

**BotW 的标志性体验**：玩家在 Hyrule 任何位置看到远方的山、塔、特殊地形，都能徒步走过去。Aonuma 在 GDC 反复说这是 BotW 的核心设计契约。

**为什么跟项目高度吻合**：山河中国本质是地理探索。"我能不能从西安走到成都？" "我能不能登太白山看一眼关中？" 这种探索动机就是 BotW 灵魂在中国地理语境的天然映射。**比 BotW 更有故事支撑**：每个目的地都背着真实历史。

**当前差距**：
- 远景塌方让玩家看不到"远处那个山"
- 地图缺少招手的视觉地标
- 没有"我必须爬到那山顶看一眼" 的诱惑

**落地形态**：
- 远景修好后（Phase 0），保证主要历史地标在 200u+ 距离仍可见 silhouette（华山的剑形、太白山的雪冠、剑门的关楼、大雁塔的轮廓）
- 每个地标都有"对应玩家位置"的视觉招手时刻 — 譬如玩家从关中平原走到一定纬度，西边远处自动出现太白雪冠 silhouette + 微 bloom
- 移动到地标附近时不需要 fast travel，保持步行体验
- 如果有飞行 mount，地标空中视角也得设计

**让用户哇塞的瞬间**：
- 玩家从西安城外往西走，远方第一次看到秦岭山墙（伴随风声变化）
- 走出剑门关洞，第一次看到成都平原全景（雾散 + sunlight pierce）
- 登五丈原顶，能远眺秦岭和渭河，明白诸葛亮当年是看着这景色去世的

---

### 1.5.2 视点驱动 Atlas 渐进解锁 — 探索的奖励循环

**BotW 标志性**：Sheikah 塔登顶解锁该区域的整张地图。"看见地图被点亮的那一刻" 是 BotW 主要的 dopamine hit 来源之一。

**为什么跟项目高度吻合**：项目已经有 Atlas Workbench（M 键打开），但目前默认全图可见，**少了渐进发现的乐趣**。中国古代的"登高望远"传统跟 Sheikah 塔机制天然契合：登泰山而小天下、登高必有所见。

**当前差距**：
- M 键打开就能看全 28 城市 + 古道 + 河流，没有"探索后才解锁"的过程
- POI 一开始就标好，少了"原来这地方还有 X" 的发现感

**落地形态**：
- 改 Atlas 默认状态：玩家未登顶的区域 atlas **半透明 / 灰雾**，登顶后才"撕开" + 显示该区域 POI
- "登顶解锁点" 设在真实历史登高地标：长安城墙 / 华山西峰 / 太白山顶 / 剑门关楼 / 蜀道大剑山 / 锦官城 / 成都浣花溪畔
- 登顶时有视觉仪式：3 秒慢镜头 + 该区域 atlas 区块从灰到清的撕开动画 + 一段编钟 / 笛声 motif
- 已解锁区域永久保留，不需要重复

**让用户哇塞的瞬间**：
- 第一次登华山，俯瞰关中盆地全图被点亮，原来 8 个县城都散在那里
- 走完整条蜀道到达成都浣花溪，整个蜀地 atlas 撕开，玩家意识到自己走过了多远

---

### 1.5.3 散落环境叙事 — 让历史从地里长出来

**BotW 标志性**：Hyrule 散落着废墟、古战场、神兽残骸、Sheikah 遗迹。游戏不告诉你"这里发生了什么"，但你看见就能拼出 100 年前的灾难。这是 BotW 评分最高的设计。

**为什么跟项目高度吻合**：**这是最该学的一项**。山河中国的核心 USP 就是"真实历史 + 真实地理"，BotW 的环境叙事手法移植过来等于"诸葛亮真的在五丈原死过、真的有箭簇 / 真的有营盘 / 真的有星象台" 直接长在地里给你看。

**当前差距**：
- 项目有"知识残简"系统但是是抽象 collectible，不是 environmental artifact
- 古道 / 古城是几何形体，没有"这里曾经发生过事" 的环境物件

**落地形态**：
- 历史遗迹真实位置投放（low-poly artifact mesh）：
  - 五丈原营盘遗迹（土堆 + 几个箭簇 + 烟灶）
  - 剑门关下坍塌栈道（几段腐烂木梁挂崖壁）
  - 武侯墓（汉中勉县，简易坟丘 + 石碑）
  - 祁山大营遗址（散落瓦砾 + 一根断旗杆）
  - 长安未央宫遗址（夯土残墙基）
  - 三星堆 / 金沙青铜面具（已有 ancient POI）
- 每个遗迹靠近时浮一句话提示（不展开成 panel），点击进 J 札记看完整背景
- 每个遗迹有对应 sound motif（武侯墓响一段秦腔、五丈原响一段编钟、三星堆响一段巴蜀古音）
- 不要标在 atlas 上 —— 让玩家自己在山河里"撞见"

**让用户哇塞的瞬间**：
- 走着走着发现山坡上一个土堆 + 几个箭簇，靠近浮"五丈原·诸葛亮病殁此地"
- 沿剑门关下行，看到崖壁上挂着腐烂栈道残段，明白"古道险" 不是文字
- 拐过祁山一个山坳，散落着瓦砾跟断旗杆，明白"六出祁山" 是真实付出过代价的

---

### 1.5.4 第一次见的"哇塞" — 视点构图与揭晓时刻

**BotW 标志性**：游戏开场出 Shrine of Resurrection，第一次走到悬崖边看到 Hyrule 全景，玩家不会忘。BotW 用 camera composition + lighting + sound 主动制造这种 reveal moment。

**为什么跟项目高度吻合**：山河中国的地理叙事天然有这种节点 —— 关中平原往西第一次见秦岭、出剑门第一次见成都、登太白第一次见雪海。**项目自带 reveal moment 的剧本**，缺的是镜头语言。

**当前差距**：
- 没有任何"reveal moment" 设计，玩家走到任何地方都是同样的镜头
- 主线节点（"逼近秦岭" / "穿过山口" / "抵达汉中"）只有文字提示，没有视觉仪式

**落地形态**：
- 在主线节点设置 **scripted camera moment**：
  - 第一次望见秦岭山墙：相机自动微抬 + 慢镜头 1.5s + 风声涌起 + 远山 silhouette 强化
  - 出剑门关洞：相机从洞内仰视，光照从洞口刺入，走出后镜头自动旋转 360° 给成都平原一眼
  - 登某历史地标顶：相机自动后拉给一个 "玩家剪影 + 远景" 构图
  - 触发雷暴的瞬间：第一道闪电时镜头微震 0.2s，全屏 white flash，雷声 1s 后到
- 触发条件用玩家位置 + 朝向，每个 reveal moment 同一存档只触发一次
- reveal 期间禁用 player input 1-2s（不剥夺感太强，但够"画面说话"）

**让用户哇塞的瞬间**：
- 出剑门关洞那一刻 —— 任何玩过古蜀文学的人都会哽咽
- 登太白山顶 reveal 雪海 + 远眺关中平原
- 三星堆遗址走近时 reveal 镜头给青铜面具特写 + 古巴蜀音乐

---

### 1.5.5 极简 HUD + 让地理本身说话

**BotW 标志性**：HUD 极简，只有一个右上角 mini-map + 体力槽。玩家靠地形 / 阳光 / 风向自己导航。

**为什么跟项目高度吻合**：项目已经在做极简方向（compass + mini-map default-open + 古风 panel）。BotW 的"trust the player to read the world" 哲学跟"山河叙事" 完美契合。

**当前差距**：
- 实际上方向对，但还可以更狠地砍 UI
- "走错路了"不是靠看 UI，应该是靠"周围环境暗示我在山里转了"

**落地形态**：
- 主线指引从"屏幕上的箭头" → 环境暗示（往汉中走的方向有特殊烟柱 / 远处有古道路标 / 风向把云吹成箭头）
- 季节性视觉指引：秋天往南飞的鸟、冬天向阳坡才有的雪化
- 距离感由 fog density / 太阳高度自动给

**让用户哇塞的瞬间**：
- 玩家在山里迷路，发现远处一缕烟，跟过去发现是古驿站
- 通过太阳位置自己判断东南西北，找到回长安的路

---

### 1.5.6 季节/时间作为 gameplay layer，不只是视觉

**BotW 标志性**：雨天爬墙打滑、夜晚怪强、寒冷地区需要保暖、热沙漠白天热夜晚冷。环境系统不只是 backdrop，是 gameplay constraint。

**为什么跟项目高度吻合**：项目已有 24 小时昼夜 + 4 季 + 天气，**但只影响视觉**。中国地理本身就有"蜀道难（雨天泥泞）"、"秦岭雪封山"、"夏汛过水"等真实约束，可以直接做。

**当前差距**：
- 季节切换只换地表色调
- 天气切换只加雨雪粒子
- 玩家行为没有任何环境约束

**落地形态**：
- 雨天古道速度 ×0.85 + 偶发滑倒动画
- 雪天秦岭海拔 >2000u 区域速度 ×0.7（"封山"）+ 视野缩短
- 夏天蜀道云雾环绕（合理）+ 河水声变大暗示汛期
- 冬天关中早上有薄雾遮日出
- 夜晚远景 silhouette 强化，玩家被动感受到"天黑赶路有压力"
- 触发条件给文字提示（"秦岭已封山，建议待春后再过"）

**让用户哇塞的瞬间**：
- 第一次雨天走褒斜道，速度变慢 + 雨刷视觉，理解"难于上青天" 不是修辞
- 冬天傍晚没赶到县城，远景全是 silhouette，意识到"夜晚赶路是真的危险"
- 春天解封秦岭后第一次过秦岭，雪化后古道露出

---

### 1.5.7 散落短目标 / 知识 micro-reward — 改造现有"残简"系统

**BotW 标志性**：Korok 种子（900 个散落短目标）+ shrine（120 个 micro-puzzle）。每完成一个有立刻反馈 + 累积感。

**为什么部分吻合**：项目已有"残简" 系统（1.5.3 提的 environmental artifact 是其增强版）。korok 思路可以改造成"地理 micro-discovery"。

**当前差距**：
- 残简放置位置可能太规律
- 缺少累积感（找了 N 个有什么变化？）

**落地形态**：
- 把 korok 思路转化为"地理 micro-discovery"：
  - 走到某海拔节点解锁"已经登上 X 海拔" 札记条目
  - 找到所有 8 条古道入口解锁古道总图
  - 走过所有 4 大盆地解锁地形全览札记
  - 涵盖 28 个真实城市解锁人文地图
- 累积奖励 = atlas 上的图层不断丰富 + 札记不断扩充，不是 stat / power

**让用户哇塞的瞬间**：
- 找到第 8 条古道入口时，atlas 自动叠加完整古道网络层
- 走完所有 4 盆地，札记里跳出"地形格局已读懂"

---

### 1.5.8 飞行/鸟瞰 — 史诗节点的视角重做

**BotW 标志性**：滑翔伞从塔顶飞下来，看见 Hyrule 在脚下展开。这是 BotW 最经典视觉。

**为什么部分吻合**：项目已有 cloud-mount 飞行系统。**但目前飞行只是更快移动方式，缺"史诗鸟瞰" 的视觉设计**。

**当前差距**：
- 飞行视角跟步行视角差不多，没有"上帝视角"那种压迫的辽阔感
- 没有专门的飞行 reveal moment

**落地形态**：
- 飞到一定高度（>200u）相机 FOV 自动微调（85 → 95），强化广角史诗感
- 飞行时云层降至腰部高度（玩家在云上）
- 高空时 atlas 自动半透明叠加在屏幕（视情决定是否做）
- 设计 **"飞行专属 reveal moment"**：
  - 从秦岭顶飞过太白山，能看见关中平原全景
  - 从汉中飞向成都，能看见整个川东盆地
  - 从西安城上飞起，长安九城对称布局清晰可见

**让用户哇塞的瞬间**：
- 飞过秦岭那一刻，视野从山墙转到平原，配一段秦风音乐
- 高空俯瞰长安城对称布局，理解"九经九纬"是真的

---

### 1.5 总结 — 这一节是项目"真正的 USP"

前面 1.1-1.4 解决"做出来不丢人"，1.5 才是 **"做出来让人哇塞"**。

| 1.5 子项 | 跟项目契合度 | 性能开销 | 工程量 |
|---|---|---|---|
| 1.5.1 看到的都能去（远景地标 + 招手） | ⭐⭐⭐⭐⭐ | 0（依赖 Phase 0 远景修好） | 1 天（招手设计 + 数据） |
| 1.5.2 视点驱动 Atlas 渐进解锁 | ⭐⭐⭐⭐⭐ | 0 | 2-3 天（atlas state + 登顶检测 + 撕开动画） |
| 1.5.3 散落环境叙事（历史遗迹） | ⭐⭐⭐⭐⭐（最该学） | +0.2ms（artifact mesh 实例） | 4-5 天（数据收集 + mesh 制作 + sound motif + 札记联动） |
| 1.5.4 第一次见的"哇塞"（reveal moment） | ⭐⭐⭐⭐⭐ | <0.1ms | 2-3 天（trigger system + camera scripts + 6-8 个 moment） |
| 1.5.5 极简 HUD + 环境暗示导航 | ⭐⭐⭐⭐ | 0 | 1-2 天（环境烟柱 / 鸟群 / 风云方向系统） |
| 1.5.6 季节作为 gameplay layer | ⭐⭐⭐⭐ | 0 | 2 天（速度调节 + 封山逻辑 + 触发提示） |
| 1.5.7 地理 micro-discovery | ⭐⭐⭐ | 0 | 1-2 天（累积条目检测 + atlas 图层 unlock） |
| 1.5.8 飞行鸟瞰 reveal | ⭐⭐⭐⭐ | 0 | 2-3 天（高空 FOV + 飞行 reveal moments） |

**1.5 总工程量：15-21 天**（独立 Phase 6-7）

性能预算：**几乎全部 ≤ 0.5ms**，因为这一节是设计 / 数据 / 系统逻辑，不是新 shader。

---

## 2. 阶段路线图（学习 + 实施叠加）

按"先解几何契约 → 再视觉风格 → 再细节"排序：

### Phase 0 — 沉浸感地基（12-15 天）

**目的**：解 1.1 远景塌方 + 1.3 穿模浮空 + 性能预算释放。视觉再好这两个不解都白做。

**实施顺序**（r6 改）：LOD geomorph 优先（解用户最痛的远看大方块）→ WindManager → Impostor。
- 不要先做 WindManager — 它现在只服务未来 cloud cookie / seasonal，先做有基建无视觉收益
- Impostor 等 LOD 距离环确定后再接，避免阈值返工

| 子任务 | 来源 | 工程量 | 状态 |
|---|---|---|---|
| HUD mini-map 节流 0.15s → 0.5s + features cache | `performance-baseline.md` | 0.5 天 | ✅ R1 |
| GroundAnchorRegistry 池 + chunk reanchor | r1 B + Codex r2 修订 | 1 天 | ✅ R2 |
| 城市/路径/scenery anchor 接管 + 路径 per-plank reanchor | r1 B 扩展 | 1 天 | ✅ R2 |
| `lastHitChunk` 缓存 | r2 优化 | 0.25 天 | ✅ R1 |
| chunk asset schema v2 spec（6.1 节定义） | r5 关键盲点 | 0.5 天 | ✅ R1 |
| **4 档 LOD geomorphing**（含 6.1 lodHeights build + T-junction 解 + height texture 对齐 + Playwright PoC） | r1 C + 1.1 BotW 学习 + r6 边界规则 | **5-7 天** | ⏳ R3 |
| WindManager / EnvironmentUniforms 全局 uniform 总线 | Codex r3 #6 | 0.5 天 | ⏳ R3+ |
| Atmospheric haze + 云影 cookie 地表 | 1.1 BotW 学习 | 1 天 | ⏳ R3+ |
| Distance impostor (scenery, 8 方向 atlas + Bayer dither) | r2 I + r5 校正 | 1 天 | ⏳ R3+ |

**r6 标的 anchor 池后续候选**（不在本轮 R1+R2 接管，留待全国化阶段处理）：
- `knowledge fragment` 拾取点 — 当前直接 sampleHeight，全国化时数量增加可能值得入 anchor 池
- 湖面 `lakeY` — 湖泊水面高度，目前固定值；如果湖面跟随地形/季节变化，需要 anchor
- `affectedBounds` 优化 — 当前 GroundAnchorRegistry custom anchor chunk-scoped 时无 bounds 过滤，每次 chunk load 全量跑 custom。当前规模 OK，全国化时（>100 chunks 同时 load）需要 custom anchor 也支持 bounds 过滤

**Phase 0 后**：远景沉浸感 70-80% BotW 复刻，穿模 95% 解决，预算释放 ~10ms（HUD），新加 +2.7ms（LOD/haze/cloud）。

### Phase 1 — 水几何契约修复（2-2.5 天）

**目的**：解 1.2 水浮空 / 死硬片 / 走势不自然。**砍物理**（splash particle 归后续阶段，本轮不做）。

| 子任务 | 来源 | 工程量 |
|---|---|---|
| build script 雕河进 chunk heightmap | r1 A 修订 | 1 天 |
| 水 mesh 跟随地形 + 删悬浮 plane | 1.2 BotW 学习 | 0.5 天 |
| 水面波纹 vertex shader (sin + normal map) | 1.2 | 0.5 天 |
| Depth foam ring（视觉 fabric，不是物理交互） | 1.2 BotW 学习 | 0.5 天 |
| 流水 UV scroll | 1.2 | 0.25 天 |
| ~~入水 splash particle~~ | 物理特效，归后续 | - |

**Phase 1 后**：水沉浸感 75-85%，几何契约 100%（不浮空、不穿模、流向看起来对），新加 +1.0ms。

### Phase 2 — 视觉风格转换（3 天）

**目的**：1.4 光照部分 + 树/草前置。

| 子任务 | 来源 | 工程量 |
|---|---|---|
| Cel + Rim shader injection (onBeforeCompile) | 1.4.1 + Codex r3 | 1 天 |
| 顶点 AO 烘焙 (build pipeline) | 1.4.1 | 0.5 天 |
| Sky-driven ambient palette 重做 | 1.4.5 + 1.4.1 | 0.5 天 |
| Hemisphere tint + 分区 cubemap (代 light probes) | Codex r3 #7 | 0.5 天 |
| 雷电 ambient flash + zigzag mesh | 1.4.4 | 0.5 天 |

**Phase 2 后**：cel-shading + 大气感立起来，新加 +2.7ms。

### Phase 3 — 天气与水视觉（3 天）

**目的**：替换简陋云雾 + 月相 + 夕阳。

| 子任务 | 来源 | 工程量 |
|---|---|---|
| Layered cloud planes (3-5 plane) 替换 7 sprite cloud puffs | 1.4.6 | 1 天 |
| 山谷雾 height-based fog | 1.4.6 | 0.5 天 |
| 月相 fragment shader (terminator) | 1.4.5 + todo P1.7 | 0.5 天 |
| Sky palette table (按 sun altitude lerp) | 1.4.5 | 0.5 天 |
| 太阳/月亮 NASA 贴图 | todo P1.5 | 0.5 天 |

**Phase 3 后**：云雾 + 天空 + 夕阳/月亮立起来，新加 +1.0ms。

### Phase 4 — 高端光照（3-4 天）

**目的**：CSM + god rays。

| 子任务 | 来源 | 工程量 |
|---|---|---|
| CSM 1-2 cascade restricted (1024-1536, only avatar + 近景城墙) | Codex r3 #2 | 2 天 |
| God rays SS-radial blur (4-pass, half-res) | 1.4.4 | 1 天 |
| Shader pre-warm pass (避免编译 hitch) | Claude 补强 | 0.5 天 |

**Phase 4 后**：阴影 + 光柱立起来，新加 +4-5ms。

### Phase 5 — 草风 + 飞行鸟瞰视觉 + 爬山 verb + frame stability (4 天)

**目的**：解封植被做草风 + 飞行视觉优化 + 爬山 verb + 帧时稳定。**砍 game design**（POI silhouette 强化 / 路径引导 / 天气 gameplay 约束 全归后续阶段）。

| 子任务 | 来源 | 工程量 |
|---|---|---|
| 解封 `HIDE_ALL_VEGETATION`（前置：先确认关闭原因） | 项目 | 0.5 天 |
| 草随风 vertex shader + 玩家压草 uniform | 1.4.2 | 1 天 |
| **飞行鸟瞰视觉**：高空 (>200u) FOV 自动调（85 → 95）+ 云层在玩家高度稍下 + 飞行时远景 LOD 半径扩大 + 高空 ambient 偏冷清 | 用户 verb 钉死 | 1 天 |
| **爬山 verb**：陡坡 speed cos(slope) 衰减但不归零 + 极陡 (>70°) 切"贴山" 状态慢速向上 + avatar 前倾姿态 | 用户 verb 钉死 | 0.5 天 |
| 帧时稳定 (rAF budget cap, 99 percentile ≤ 18ms) | Codex r3 #8 | 1 天 |
| 相机构图基础健康 (overview pitch limit, 山谷自动微抬避免视线被压死) | Codex r3 #8 | 0.5 天 |
| ~~POI silhouette / 路径引导 / 天气 gameplay 反馈~~ | game design，归后续 | - |
| ~~落叶 trail~~ | 移到 Phase 6（季节性内容） | - |

**Phase 5 后**：草风 + readability + frame stability，新加 +0.5ms。

### Phase 6 — 世界的呼吸（季节 / 时间 / 天气 / 动植物 / 地域 biome 12 区） (17-19 天)

**目的**：落地 1.4.7 全部内容（季节 + 时间 + 天气 + 动植物 + **地域 biome 多样性**）。让世界"在呼吸"且"地域可读"。

| 子任务 | 来源 | 工程量 |
|---|---|---|
| 季节 seasonalTint uniform + 植被颜色 lerp + terrain 色调强化 | 1.4.7 季节 | 1 天 |
| 落叶 particle (秋) + 雪覆盖 shader (冬高海拔) + 水部分结冰 | 1.4.7 季节 | 1 天 |
| 春季桃李梨花 instance / particle 点缀 | 1.4.7 季节 | 0.5 天 |
| 日出 / 日落 dramatic palette ramp + 山体晨昏金边 rim 强化 | 1.4.7 时间 | 0.5 天 |
| 夏夜萤火虫 particle + 远城灯火点点（夜）+ 月光满月时增强 | 1.4.7 时间 | 0.5 天 |
| 天气状态平滑 lerp（8-15s 过渡，不硬切） | 1.4.7 天气 | 0.5 天 |
| 多云 / 阴天 variant（layered cloud + ambient 降饱和） | 1.4.7 天气 | 0.5 天 |
| 晨雾（5-7am 自动）+ 山间雾（低洼区按高度密度） | 1.4.7 天气 | 1 天 |
| 雨后地面湿润 reflection + 雪后雪盖累积 | 1.4.7 天气 | 0.5 天 |
| 候鸟季节性迁徙（春北 / 秋南 V 字队列） | 1.4.7 动植物 | 0.5 天 |
| 季节性环境音切换（夏蝉 / 秋虫 / 冬寂） | 1.4.7 动植物 | 0.5 天 |
| **地域 biome 数据收集 — 当前秦岭切片 4 区**（秦岭/关中/汉中/四川 各 3-5 种 IUCN/中国植物志查证） | 1.4.7 地域 + 用户钉死 | 2 天 |
| **地域 biome 数据收集 — 未来扩区 8 区**（青藏/西北/黄土/江南/华北/东北/华南/云贵 各 3-5 种 IUCN 查证） | 1.4.7 地域 + 用户"12 区代表物种要齐" | 4 天 |
| **build pipeline biome lookup**（chunk 按 lat/lon/海拔查 biome table，spawn 该 biome 的 scenery / wildlife） | 1.4.7 地域 | 1 天 |
| **biome mesh / texture 制作**（每个旗舰物种 1 个低多边形 mesh + 必要 texture，12 区累计 ~36-60 个新 mesh） | 1.4.7 地域 | 4-6 天 |

**Phase 6 后**：玩家停下来不操作，世界仍然在变 — 云飘、草摇、鸟飞、季节转、雨下、候鸟迁徙。这是"沉浸感"的核心 — **世界本身有生命**，不是为玩家表演的舞台。

### 总时间表（v2.1 — 吸收 r5 再校准）

r5 评 v2 仍乐观。v2.1 加 Phase 0 第 0 步 schema 1 天 + Phase 6 物种数据/QA 翻倍：

| 阶段 | v1 | v2 | **v2.1 (吸收 r5)** | 累计 |
|---|---|---|---|---|
| Phase 0 沉浸感地基 + asset schema 契约 | 5-6 | 8-10 | **12-15 天** | 12-15 |
| Phase 1 水几何契约（砍物理） | 2-2.5 | 4-5 | **4-5 天** | 16-20 |
| Phase 2 视觉风格 | 3 | 3-4 | **3-4 天** | 19-24 |
| Phase 3 天气云雾 | 3 | 3-4 | **3-4 天** | 22-28 |
| Phase 4 高端光照 (CSM + god rays) | 3-4 | 6-8 | **6-8 天** | 28-36 |
| Phase 5 草风+飞行+爬山+稳帧 | 4 | 4-5 | **4-5 天** | 32-41 |
| **Phase 6 世界呼吸+地域 biome（12 区物种）** | 6-7 | 8-9 | **17-19 天**（v2.2 r6 校准：12 区数据 + mesh 制作） | **49-60 天** |

**v2.2 总工程：49-60 天**（v1 29-30 天 → r6 校准后 +69-100%，吸收 r4 + r5 + r6 三轮 critique）。

**翻倍最容易的**（r5 标）：Phase 0 和 Phase 6。Phase 0 因 LOD geomorph + impostor + anchor + cloud cookie 一起做；Phase 6 因 12 区物种 mesh / 音频 / QA 工作量低估。

**关键判断不变**：本轮范围（0.5 节钉死）= 景色本身的美 + 走/爬/飞 verbs + 世界自己呼吸 + 地域可读。Phase 0-6 全做完后，玩家闲逛在"真实美丽沉浸"的山河里，没有 bug，没有打扰。

性能预算累计：Phase 0-5 净 +1.6ms + Phase 6 +1.4ms = **总净 +3ms**。M-series Mac follow camera ~3.4ms / overview ~5.4ms（含 HUD 优化后），离 16.7ms 红线还有 13ms 余量，安全。

**已删除阶段（归后续路线）**：
- ~~Phase 7 散落环境叙事 + micro-discovery + scripted reveal moments + atlas 渐进解锁~~ → 1.5 节（后续阶段，本轮不做）

---

## 3. 删除项 / 替代项总表（不变）

| 想做的 | 删除原因 | 替代方案 |
|---|---|---|
| 真骨骼 SkinnedMesh | Codex 实测 15-25 天起，含 IK 25-35 天 | 现有 primitive avatar 保留 |
| CSM 4-cascade | shadow pass draw ×3-4 | 1-2 cascade restricted 已够 |
| 完整平面反射 | 双倍渲染 +6-8ms | 仅天空 + 远山 reflection |
| 真 volumetric cloud raymarch | 浏览器死刑 (+30-60ms) | layered planes |
| 真实时 GI | 浏览器死刑 | hemisphere tint + 分区 cubemap |
| MeshPhysicalMaterial PBR | 风格不搭 + 一致性债务 | MeshPhong + onBeforeCompile cel/rim |
| 50000 粒子沙暴 | +20ms | ≤ 5000 + 视距 cull |

---

## 4. Quality Tier preset

| Preset | 配置 |
|---|---|
| Tier 1 (M1 Air) | Phase 0 (无 geomorph 简化版) + Phase 1 + Phase 2 (无 cubemap) + Phase 5 草风+frame stability + Phase 6 (季节/时间基础, 砍多云/晨雾/萤火虫)。无 CSM, 无 god rays, 无 layered cloud (用现有 7 sprite) |
| Tier 2 (M2/M3) | Phase 0-6 全开。CSM 1-2 cascade restricted, god rays SS, layered clouds, sky-only reflection, 完整世界呼吸 |

切换：`localStorage.QUALITY_TIER = "1" | "2"`

---

## 4.5 Fallback 决策树（r6 关键盲点 — Phase 4 实施前必备）

r6 警告 +3ms 总预算不安全：overview HUD 优化前 12-13ms，Phase 4 CSM/god rays 上去 fps 必爆。R1 已经清掉 HUD 12ms（实测 overview 60fps vsync 0 dropped），但 Phase 4 仍要预备明确降级路径。

### CSM 决策树（目标 ≤ 3ms）

```
CSM 实施完成后实测 (M-series Mac, prod build, 1440×900)
  ↓
ms ≤ 3: 维持 4 cascade (avatar + 近景城墙 + 名胜)
  ↓
ms 3-4.5: 降到 2 cascade (avatar + 近景城墙)
  ↓
ms 4.5-6: 只 follow camera 视锥内 1 cascade (avatar only)
  ↓
ms > 6: 关闭 CSM，回退到顶点 AO 烘焙 + hemisphere tint
```

每一档降级都要 Playwright 截图前后对比，确认视觉损失可接受。

### God rays 决策树（目标 ≤ 2ms）

```
God rays 实施完成后实测
  ↓
ms ≤ 2: 维持 4-pass radial blur half-res
  ↓
ms 2-3: half-res + temporal jitter（每 2 帧更新）
  ↓
ms 3-4: 只在日出日落（sun altitude < 15°）启用
  ↓
ms > 4: 替换为静态 sun halo sprite + UnrealBloom 加强
```

### Tier 1 fallback (M1 Air / 旧 Mac)

如果 Tier 2 在 M-series Mac prod 仍然爆预算，**Tier 1 自动剥离**：CSM / god rays / layered cloud / 平面反射 全关，只保留 cel + rim + atmospheric haze + cloud cookie + 4 档 LOD geomorph。Tier 1 目标 30-45fps，足够"闲逛 + 看景" 体验。

---

## 5. 验收协议（每 Phase 末必跑）

复用 `todo.md` 末尾约定 + 新增学习验证：

1. commit Phase 改动
2. `npm test` + `npm run build` 必须通过
3. Playwright 截图前后对比，附进 commit
4. **新**：对应 `docs/learning/*.md` 笔记完成度检查
5. `/codex review` 复核
6. 性能验证：M-series Mac prod build, default-follow ≥60fps, overview ≥30fps, 99 percentile frame ≤18ms (Phase 5 引入后)
7. **Atlas 同步检查**（`feedback_atlas_3d_sync.md`）

---

## 6. Codex review 历史 + 抓到的 BotW 思路盲点

（这一节会随每轮 Codex review 增长，记录 Claude 漏掉的 BotW 思路）

### r6 (已收) — v2.1 + R1+R2 复审 → v2.2 收敛
- 评估对象：v2.1 plan + R1+R2 真实代码 + Playwright perf 数字
- **总判：v2.1 + R1+R2 健康，继续 R3 实施**（无 must-fix-before-code 阻塞）
- 7 项裁定全部消化：
  - A. r5 注释吸收度 → 4 处文档纠偏（已修：1.4.7 加 [公开]/[部分]/[自创] 标 + Phase 6 12 区任务表 + 时间表 44-57 → 49-60 + 6.1/6.2 编号）✅
  - B. 1.4.7 真实性 → 落叶累积/春花/雪后累积/候鸟/雨后湿润全部标 [自创]（已修）✅
  - C. R1+R2 代码健康 → 唯一注意 custom anchor 全国化要加 affectedBounds（已加进 Phase 0 后续候选清单）✅
  - D. Phase 4 fallback 决策树 → 加新 4.5 节 CSM/god rays 降级路径（已加）✅
  - E. Phase 0 估时 → R1+R2 是 plumbing easy wins；LOD geomorph 单项 5-7 天合理（已校准 Phase 0 子任务表）✅
  - F. 实施顺序改 → LOD geomorph → WindManager → Impostor（已写进 Phase 0 实施顺序提示）✅
  - G. 新发现 → 7.1/7.2 编号漂移修成 6.1/6.2 ✅；Phase 6 12 区 vs 任务表 4 区冲突已修 ✅

### r5 (已收) — 摘要 + 收敛
- 评估对象：v2
- **总判：v2 收敛，可进入实施**，但先补 v2.1 技术注释（已在本文档各节就地标注）
- 关键技术细节澄清（已吸收）：
  - LOD geomorph：同拓扑 ring + `mix(y0, y1, uMorph)`；不同分辨率不能直接 attribute lerp，要用 height texture 双级 DEM 采样 ✅
  - Cloud cookie：用 `vWorldPosition.xz * scale + wind*time`，无需 modelMatrix decompose ✅
  - Impostor：8 方向起步 + 4x4/8x8 Bayer dither（不要 noise texture，会闪）✅
  - Depth foam PoC：先建 depthTexture / 不带 composer 跑 / 接 Bloom / 试 MSAA ✅
- 1.4.7 真实性纠错（已吸收）：BotW 真有 = 动态天气/雨/雪/雷暴/雨转雪/天气预报/月相/血月/萤火虫；BotW 无 / Claude 推测 = 四季 cycle / 落叶累积 / 春花 / 候鸟迁徙 / 雨后湿润持久 ✅
- 估时再校准（v2 → v2.1）：Phase 0 8-10 → 12-15；Phase 6 8-9 → 12-16（**总 v2.1 估时 44-57 天**）✅
- 关键盲点（已新增到 v2.1）：
  - 🚨 数据管线撞车 — 雕河/城市压平/AO/biome/LOD height texture 都改 chunk asset → **必须先定义 asset schema/version** ✅ (新增 8 节)
  - 🚨 shader 注入统一 — `terrainShaderEnhancer` 已接管 fog/atmospheric/HSL → cel/rim/cloud cookie 走它，不要分散三套 onBeforeCompile ✅ (新增 9 节)
  - 🚨 +3ms 不安全 — Phase 4 CSM/god rays 会吃爆 overview → 需 fallback 策略（写进 fallback 章节） ✅
- Phase 0 实施顺序（按 r5）：HUD 节流 → lastHitChunk 缓存 → GroundAnchor 池 → 城市/路径/scenery anchor → WindManager → LOD geomorph → Impostor

### r4 (已收) — 摘要
- 评估对象：本文档 v1
- 关键纠错（已吸收到 v2）：
  - "BotW 怎么解" 大部分是"合理开放世界技法"而非"BotW 确认"。降级为 "BotW-inspired"，三栏区分 公开/推测/替代 ✅
  - LOD geomorph：CPU 改 BufferAttribute 是 GPU upload 灾难。改 vertex shader 端 uniform-driven height attribute lerp ✅
  - 云影：sky cubemap alpha 不对。改 world-space 2D cloud cookie ✅
  - Impostor：4-quad billboard 有"风车感"。改多角度 atlas + dither fade ✅
  - depth foam：跟 EffectComposer + MSAA 兼容是已知坑，需 PoC ✅
  - 估时乐观：Phase 0 应 8-12 / Phase 1 6-8 / Phase 4 6-10。v2 时间表已校准 ✅
  - 漏 frame pacing / streaming 学习。已加 `botw-performance-and-streaming.md` ✅
  - 学习笔记三栏（公开/推测/替代）✅
- 总判：v1 值得进 v2 迭代，但要降级为"BotW-inspired" → 已做

### r3 (已收) — 摘要
- L+W 是 ROI 最高的两阶段（已采纳，分散到 Phase 2/3/4）
- CSM restricted 配置（已采纳）
- 假体积云别叫 volumetric（已采纳）
- 真骨骼 15-25 天（已采纳，删除）
- 不切 PBR（已采纳）
- WindManager 全局共享（已采纳，Phase 0）
- Light probes 降级为 hemisphere tint（已采纳）
- BotW 隐藏 8 项（已采纳，分散到 Phase 5）

---

## 6.1 数据管线 asset schema 契约（r5 关键盲点 — 必须 Phase 0 第 0 步定义）

r5 警告：Phase 0-6 有 5 个 build pipeline 改动同时碰 chunk asset：
1. 雕河（Phase 1）— water mask + 雕低 height
2. 城市压平（Phase 0）— flatten city footprint
3. 顶点 AO 烘焙（Phase 2）— vertex color alpha
4. Biome lookup（Phase 6）— `biomeId` + `speciesRecipe` + `seasonalRecipe`
5. LOD height texture（Phase 0）— L0/L1/L2/L3 双级高度采样

**全部改 chunk asset，不先定义 schema/version 必撞车**。

**Phase 0 第 0 步**（HUD 节流之前）：
- 在 `docs/dem-asset-format-and-boundary-spec.md` 添 v2 spec：
  ```
  chunk asset v2:
    height: Float32Array (existing)
    waterMask: Uint8Array (Phase 1 新增)
    cityFlattened: bool + footprintList (Phase 0 新增)
    vertexAo: Uint8Array (Phase 2 新增)
    biomeId: string (Phase 6 新增)
    speciesRecipe: { trees: [...], wildlife: [...] } (Phase 6 新增)
    seasonalRecipe: { springColor, autumnDrop, winterSnowMask } (Phase 6 新增)
    lodHeights: { L1: Float32Array, L2: Float32Array, L3: Float32Array } (Phase 0 新增)
  manifest:
    schemaVersion: 2  // bump from 1
  ```
- runtime `loadChunkAsset` 检测 schemaVersion，向后兼容 v1
- 所有 build script (Phase 0/1/2/6 改动) 都按 v2 写入

**工程量**：0.5 天 spec 设计 + 0.5 天 runtime 兼容判断 = **Phase 0 新增 1 天**

---

## 6.2 Shader 注入统一性（r5 关键盲点）

r5 警告：项目已有 `terrainShaderEnhancer.ts` 接管 terrain shader 的 fog/atmospheric/HSL 注入。**Phase 1 cel-shading + Phase 1 rim + Phase 0 cloud cookie + Phase 0 atmospheric haze 这 4 项都需要往 terrain fragment shader 注入新逻辑**。

❌ **不要做**：每个特性单独写一个 onBeforeCompile，分散三套五套，互相覆盖、调试地狱

✅ **必须做**：扩展 `terrainShaderEnhancer.ts`，把 cel/rim/cloud cookie/haze 全部加进去，**单一 onBeforeCompile 入口**，按 uniform 开关

```ts
// 扩展后的 terrainShaderEnhancer.ts 接口
interface TerrainShaderEnhancerOptions {
  enableHeightFog: boolean    // 已有
  enableAtmospheric: boolean  // 已有
  enableHsl: boolean          // 已有
  enableCelShading: boolean   // Phase 1 新增
  enableRim: boolean          // Phase 1 新增
  enableCloudCookie: boolean  // Phase 0 新增
  enableSeasonalTint: boolean // Phase 6 新增
  enableSnowOverlay: boolean  // Phase 6 新增
}
```

scenery / wildlife shader 同样思路：扩展 `proceduralTextures.ts` 或新建 `sceneryShaderEnhancer.ts`，统一接管 cel/rim/seasonal tint。

**工程量**：纳入 Phase 1 cel-shading 子任务，无独立工程量

---

## 7. 学习产出清单

代码之外，本路线图完成时应有：

**技术学习（对应 1.1-1.4，本轮要做）**：
- `docs/learning/botw-distance-fade.md` — geomorphing + 大气透视 + 云 cookie
- `docs/learning/botw-water-tricks.md` — 雕河 build + depth foam + UV scroll
- `docs/learning/botw-ground-contract.md` — anchor registry + per-vertex path sample
- `docs/learning/botw-lighting-and-weather.md` — cel toon + sky palette + cloud cookie
- `docs/learning/botw-world-breathing.md` — 季节/时间/天气/动植物变化的 BotW 做法 + 浏览器移植
- `docs/learning/botw-china-biomes.md` — 中国地理分区 flora/fauna 代表物种表 + IUCN 引用
- `docs/learning/botw-performance-and-streaming.md` — frame pacing / streaming / chunk fade / DRS（r4 加，避免遗漏）
- `docs/learning/botw-vs-browser-gap.md` — 我们没复刻的部分 + 原因（最坦诚的一份）

**每篇结构**（r4 强调）：必须三栏 — **公开确认 / 强推测 / 浏览器替代**。不要把推测写成定论。

**体验设计学习（对应 1.5，后续阶段，本轮不做）**：
- `docs/learning/botw-environmental-storytelling.md` — 散落环境叙事如何让玩家自己拼故事 + 我们的中国历史移植样本
- `docs/learning/botw-reveal-moments.md` — Aonuma 的"camera moment" 设计 + 6-8 个山河中国 reveal 剧本
- `docs/learning/botw-progressive-discovery.md` — Sheikah 塔 / Korok / micro-reward 累积循环 + Atlas 渐进解锁映射
- `docs/learning/botw-environment-as-gameplay.md` — 季节/天气作为约束系统 + 山河中国"封山 / 汛期 / 蜀道滑" 落地

---

## 附

- 上一版 plan：`docs/botw-tier-roadmap-r3-revised.md`（已废弃）
- Codex r3 raw critique：`/tmp/codex-r3-final.md`
- 当前 perf baseline：`docs/performance-baseline.md`
- 项目视觉风格原则：`docs/visual-style-and-performance-budget.md`
- 用户最近痛点（5/10 凌晨陈述）：远景大方块、水浮空死硬片、城市/古道穿模、光照树草风雷电夕阳月亮云雾简陋
