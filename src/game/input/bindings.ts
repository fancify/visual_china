// bindings.ts — 默认键位 SSOT。改键就改这里。
// 设计 spec: docs/superpowers/specs/2026-05-15-control-scheme-redesign-design.md

import type { Binding } from "./types.js";

export const DEFAULT_BINDINGS: Binding[] = [
  // ── 运动层 ──────────────────────────────────────────────────────────
  { action: "move.forward",  code: "KeyW",      emit: "down", repeat: false, note: "前进" },
  { action: "move.back",     code: "KeyS",      emit: "down", repeat: false, note: "后退" },
  { action: "move.left",     code: "KeyA",      emit: "down", repeat: false, note: "左转" },
  { action: "move.right",    code: "KeyD",      emit: "down", repeat: false, note: "右转" },
  { action: "move.sprint",   code: "ShiftLeft", emit: "down", repeat: false, note: "加速" },
  { action: "move.sprint",   code: "ShiftRight",emit: "down", repeat: false, note: "加速 (右 Shift)" },
  { action: "move.ascend",   code: "Space",     emit: "down", repeat: false, note: "跳 / 飞升" },
  { action: "move.descend",  code: "ControlLeft", emit: "down", repeat: false, note: "蹲 / 飞降" },
  { action: "move.descend",  code: "ControlRight", emit: "down", repeat: false, note: "蹲 / 飞降 (右 Ctrl)" },
  // P 切坐骑（Tab 在浏览器里会触发 focus next，不能用）
  { action: "mount.cycle",   code: "KeyP",      emit: "down", repeat: false, note: "切换走/剑/云" },

  // ── 视角层 ──────────────────────────────────────────────────────────
  // LMB 和 RMB 都能拖镜头；LMB 短按是 world.pick（点 POI）— InputManager 会用
  // pointerdown→up 间累计移动量区分 click vs drag (阈值 4px)。
  { action: "camera.rotate", mouseButton: 2,    emit: "drag", note: "RMB 拖拽转视角" },
  { action: "camera.rotate", mouseButton: 0,    emit: "drag", note: "LMB 拖拽转视角（短按是 pick）" },
  { action: "camera.zoom",                      emit: "wheel", note: "滚轮缩放" },
  { action: "camera.yawLeft",  code: "KeyQ",    emit: "down", note: "键盘左转" },
  { action: "camera.yawRight", code: "KeyE",    emit: "down", note: "键盘右转" },
  { action: "camera.followReset",    code: "KeyF", emit: "click", note: "复位 follow cam" },
  { action: "camera.overview",       code: "KeyO", emit: "click", note: "鸟瞰" },
  { action: "camera.toggleImmersion", code: "KeyV", emit: "click", note: "切沉浸 (pointer lock)" },

  // ── 交互层 ──────────────────────────────────────────────────────────
  { action: "world.pick",      mouseButton: 0,  emit: "click", note: "点 POI / minimap" },
  { action: "world.interact",  code: "KeyE",    emit: "click", modifier: "Shift", note: "Shift+E 交互（避免和 yawRight 冲突）" },

  // ── 叙事产品层（保留主键位）────────────────────────────────────────
  { action: "world.cycleTime",    code: "KeyT", emit: "click", note: "时间 +3h" },
  { action: "world.cycleSeason",  code: "KeyL", emit: "click", note: "切季节" },
  { action: "world.cycleWeather", code: "KeyK", emit: "click", note: "切天气" },

  // ── UI ─────────────────────────────────────────────────────────────
  { action: "ui.toggleMap",        code: "KeyM",   emit: "click", note: "atlas 全屏" },
  { action: "ui.togglePoiDetail",  code: "KeyI",   emit: "click", note: "POI 详情" },
  // ui.pauseMenu 暂时不绑（P 给 mount.cycle 让出来）
  { action: "ui.dismiss",          code: "Escape", emit: "click", note: "关最上层 / 退锁定" },

  // ── Debug ──────────────────────────────────────────────────────────
  { action: "debug.togglePanel",   code: "Backquote", emit: "click", note: "唤起 debug 面板" }
];

/** 给现有 characterInputFromKeySet 用的 action → key 字符串映射。 */
export const ACTION_TO_LEGACY_KEY: Partial<Record<string, string>> = {
  "move.forward":  "w",
  "move.back":     "s",
  "move.left":     "a",
  "move.right":    "d",
  "move.sprint":   "shift",
  "move.ascend":   " ",
  "move.descend":  "c",
  "mount.cycle":   "p"
};
