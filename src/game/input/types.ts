// types.ts — 控制方案 SSOT 类型定义。
// 设计 spec: docs/superpowers/specs/2026-05-15-control-scheme-redesign-design.md

export type ActionName =
  | "move.forward"
  | "move.back"
  | "move.left"
  | "move.right"
  | "move.sprint"
  | "move.ascend"
  | "move.descend"
  | "mount.cycle"
  | "camera.rotate"
  | "camera.zoom"
  | "camera.yawLeft"
  | "camera.yawRight"
  | "camera.followReset"
  | "camera.overview"
  | "camera.toggleImmersion"
  | "world.pick"
  | "world.interact"
  | "world.cycleTime"
  | "world.cycleSeason"
  | "world.cycleWeather"
  | "ui.toggleMap"
  | "ui.togglePoiDetail"
  | "ui.pauseMenu"
  | "ui.dismiss"
  | "debug.togglePanel"
  | "debug.directClip";

export type ActionPayload =
  | { kind: "press" }
  | { kind: "release" }
  | { kind: "drag"; deltaX: number; deltaY: number }
  | { kind: "wheel"; delta: number }
  | { kind: "pick"; clientX: number; clientY: number }
  | { kind: "digit"; value: number };

export type ActionHandler = (payload: ActionPayload) => void;

export type EmitTrigger = "down" | "up" | "drag" | "wheel" | "click";

export interface Binding {
  action: ActionName;
  /** keyboard physical code (e.g., "KeyW", "Space", "Backquote", "Tab"). */
  code?: string;
  /** mouse button (0=LMB, 1=MMB, 2=RMB). */
  mouseButton?: 0 | 1 | 2;
  /** modifier required to fire. undefined = any. "none" = explicitly no modifier. */
  modifier?: "Shift" | "Ctrl" | "Alt" | "none";
  /** when to emit the action. */
  emit: EmitTrigger;
  /** repeating: 长按时是否重复 emit. default false (一按一发). */
  repeat?: boolean;
  /** 内部 note，不影响逻辑. */
  note?: string;
}

/**
 * 角色控制读出用的"伪 key set" — 保留 characterInputFromKeySet API 兼容。
 * InputManager 把激活的 action 翻译回 key 字符串，喂给 characterRuntime。
 */
export interface CharacterKeyView {
  hasKey(key: string): boolean;
  asSet(): Set<string>;
}
