# Control Scheme Redesign — 2026-05-15

> 目标：把散落在 `pyramid-demo.ts` / `main.ts` / `characterRuntime.ts` 三处的 key/mouse 处理统一到一个 SSOT；修 P/F 双绑 + 鼠标 yaw 反向；用 backtick-toggle debug 面板替代散键 G/H/R/B/D/1/2/3。

## 1. 决策摘要

- **游戏定位**：BotW 风第三人称探索（不需一/三人称切换、不需战斗预留键位）
- **镜头范式**：A 混合模式 — 默认 free cursor，RMB 拖拽转视角，V 切换沉浸锁定模式
- **Debug 入口**：`键唤起 lil-gui 风浮动面板（toggle 按钮 + slider），不做文字命令解析
- **T/L/K**：保留主键位（时间/季节/天气是叙事产品功能）
- **架构**：方案 A — `src/game/input/` 模块作为 SSOT
- **键盘**：WASD 唯一，去掉方向键冗余

## 2. 键位表（最终）

| 层 | 键 | Action | 备注 |
|---|---|---|---|
| 运动 | W A S D | `move.{forward,left,back,right}` | 仅 WASD |
| | Shift | `move.sprint` | 加 FOV pump（后续 polish） |
| | Space | `move.ascend` | 跳 / 飞行上升 |
| | Ctrl | `move.descend` | 蹲 / 飞行下降（替代 C） |
| | Tab | `mount.cycle` | 切坐骑（替代 P） |
| 视角 | RMB drag | `camera.rotate` | 修正反向 yaw |
| | 滚轮 | `camera.zoom` | |
| | Q E | `camera.yaw{Left,Right}` | 加 ease curve |
| | V | `camera.toggleImmersion` | pointer lock 进/出 |
| | F | `camera.followReset` | 复位（删 pyramid-demo 的"拉近 10m"） |
| | O | `camera.overview` | 鸟瞰 |
| | Esc | `ui.dismiss` | 关 UI → 退锁定 |
| 交互 | LMB | `world.pick` | 点 POI / minimap |
| | E | `world.interact` | 预留 |
| 叙事 | T | `world.cycleTime` | |
| | L | `world.cycleSeason` | |
| | K | `world.cycleWeather` | |
| UI | M | `ui.toggleMap` | atlas |
| | I | `ui.togglePoiDetail` | |
| | P | `ui.pauseMenu` | 恢复通用 Pause 语义 |
| Debug | \` | `debug.togglePanel` | 唤起浮动 toggle 面板 |

废弃：方向键移动、X 上升、C 下降、G/H/R/B/D/1/2/3 散键、Alt+1-7。

## 3. Debug 面板内容

按 `（反引号）开/关。lil-gui 风浮动 250px 宽 panel，含：

- `[✓] Flat shading` — 切 flatShading
- `[✓] LOD tint` — 切 LOD 染色
- `[✓] Debug overlay` — chunk grid + POI + 经纬度
- `[✓] Beach tint` — 沙滩色带
- `Time: ── slider 0-24 ──` 直接拖
- `Weather: ▼ dropdown` — 7 种天气
- `Season: ▼ dropdown` — 4 季
- `FPS: 60` — 实时显示

无文字命令、无 autocomplete、无历史。

## 4. 代码架构

```
src/game/input/
  ├── types.ts          — ActionName 联合 + payload + Binding 接口
  ├── bindings.ts       — DEFAULT_BINDINGS 表（SSOT）
  ├── InputManager.ts   — DOM 监听 + active state + emit
  ├── DebugPanel.ts     — 浮动面板 UI
  └── *.js              — shim
```

### 数据流

```
DOM event (keydown / pointermove / wheel)
   ↓ InputManager.handleEvent()
   ↓ 匹配 binding → 更新 active 状态 / emit action
   ↓ 订阅者通过 InputManager.on(action, handler)
```

### 与现有代码的兼容

- `characterInputFromKeySet(keys: Set<string>)` 保留不动
- pyramid-demo.ts 不再维护 `keys` Set；通过 `inputManager.activeKeysForCharacter()` 派生

## 5. 鼠标改动

- 当前：LMB 拖拽，`yaw -= dx * 0.005`
- 新：**RMB** 拖拽，`yaw += dx * 0.005`（修正反向）
- LMB 释放给 `world.pick`（点击 POI / minimap）

## 6. 不做（YAGNI）

- Gamepad / 触屏支持
- 键位 remap UI（架构允许未来加，但本次不实现）
- 命令历史 / autocomplete
- Context stack 完整实现（最小版：debug 面板打开时屏蔽 WASD）

## 7. 测试策略

- `npm run test:fast` 守住 contract / regression baseline 不变
- 加 `scripts/input-bindings.test.mjs` — 测试 InputManager 的 action emit
- Playwright 验收：在 pyramid-demo 实际按 W / RMB / \` 看效果
