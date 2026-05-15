// InputManager.ts — DOM 事件 → action 派发 + active state 维护。
//
// 设计原则：
// - 唯一 SSOT 是 bindings.ts，本文件只是 dispatcher。
// - 保留 characterInputFromKeySet API：通过 activeKeysForCharacter() 派生伪 key set。
// - "context" 简版：只支持屏蔽全部运动 binding (debug 面板打开时用)。

import type { ActionHandler, ActionName, ActionPayload, Binding, CharacterKeyView } from "./types.js";
import { ACTION_TO_LEGACY_KEY, DEFAULT_BINDINGS } from "./bindings.js";

export interface InputManagerOptions {
  /** 监听键盘事件的 target，默认 window。 */
  keyboardTarget?: HTMLElement | Window;
  /** 监听鼠标事件的 target，默认 canvas。 */
  pointerTarget: HTMLCanvasElement;
  /** 自定义 binding 表 (测试用)。 */
  bindings?: Binding[];
}

export interface InputManager {
  on(action: ActionName, handler: ActionHandler): () => void;
  isPressed(action: ActionName): boolean;
  characterKeys(): CharacterKeyView;
  pushContext(name: "menu" | "debugPanel"): void;
  popContext(name: "menu" | "debugPanel"): void;
  dispose(): void;
}

interface InternalState {
  bindings: Binding[];
  handlers: Map<ActionName, Set<ActionHandler>>;
  activeCodes: Set<string>;
  activeActions: Set<ActionName>;
  contextStack: string[];
  pointerDownButton: number | null;
  pointerDownAt: { x: number; y: number } | null;
  /** 同一次 pointerdown→up 内的累计移动；用来区分 click 和 drag */
  pointerDragAccum: number;
  lastPointer: { x: number; y: number };
  canvas: HTMLCanvasElement;
  unbinders: Array<() => void>;
}

/** pointerdown 到 up 间累计移动小于此值视为 click（不是 drag） */
const CLICK_DRAG_THRESHOLD_PX = 4;

const SUPPRESS_MOVE_IN_CONTEXTS = new Set(["debugPanel", "menu"]);

function matchesModifier(binding: Binding, e: KeyboardEvent | MouseEvent | WheelEvent): boolean {
  if (!binding.modifier) return true;
  if (binding.modifier === "none") return !(e.shiftKey || e.ctrlKey || e.altKey || e.metaKey);
  if (binding.modifier === "Shift") return e.shiftKey;
  if (binding.modifier === "Ctrl") return e.ctrlKey;
  if (binding.modifier === "Alt") return e.altKey;
  return true;
}

function shouldSuppress(state: InternalState, action: ActionName): boolean {
  if (state.contextStack.length === 0) return false;
  const top = state.contextStack[state.contextStack.length - 1];
  if (!SUPPRESS_MOVE_IN_CONTEXTS.has(top)) return false;
  // 仅屏蔽运动/交互；UI 自己的键 (Escape / Backquote) 永远通过。
  return action.startsWith("move.")
      || action.startsWith("camera.")
      || action.startsWith("mount.")
      || action.startsWith("world.cycle")
      || action === "world.pick"
      || action === "world.interact";
}

function emit(state: InternalState, action: ActionName, payload: ActionPayload): void {
  if (shouldSuppress(state, action)) return;
  const handlers = state.handlers.get(action);
  if (!handlers) return;
  for (const handler of handlers) handler(payload);
}

function setActive(state: InternalState, action: ActionName, active: boolean): void {
  if (active) state.activeActions.add(action);
  else state.activeActions.delete(action);
}

function handleKeyDown(state: InternalState, e: KeyboardEvent): void {
  if (e.repeat) {
    // 默认不让浏览器自动 repeat 触发 action.click。run-loop 用 isPressed 取连续状态。
    return;
  }
  if (state.activeCodes.has(e.code)) return;
  state.activeCodes.add(e.code);

  for (const binding of state.bindings) {
    if (binding.code !== e.code) continue;
    if (!matchesModifier(binding, e)) continue;
    if (binding.emit === "down") {
      setActive(state, binding.action, true);
      emit(state, binding.action, { kind: "press" });
    } else if (binding.emit === "click") {
      // 立即发一次，press/release 不重要。
      if (binding.code === "Tab") e.preventDefault();
      emit(state, binding.action, { kind: "press" });
    }
  }
}

function handleKeyUp(state: InternalState, e: KeyboardEvent): void {
  state.activeCodes.delete(e.code);
  for (const binding of state.bindings) {
    if (binding.code !== e.code) continue;
    if (binding.emit === "down") {
      setActive(state, binding.action, false);
      emit(state, binding.action, { kind: "release" });
    }
  }
}

function handlePointerDown(state: InternalState, e: PointerEvent): void {
  state.pointerDownButton = e.button;
  state.pointerDownAt = { x: e.clientX, y: e.clientY };
  state.pointerDragAccum = 0;
  state.lastPointer = { x: e.clientX, y: e.clientY };
  // pointerdown 不再立刻 emit click — 等 pointerup 看是否真的 click（无明显移动）
  for (const binding of state.bindings) {
    if (binding.mouseButton !== e.button) continue;
    if (!matchesModifier(binding, e)) continue;
    if (binding.emit === "drag") {
      setActive(state, binding.action, true);
    }
  }
}

function handlePointerUp(state: InternalState, e: PointerEvent): void {
  const wasClick = state.pointerDragAccum < CLICK_DRAG_THRESHOLD_PX;
  for (const binding of state.bindings) {
    if (binding.mouseButton !== e.button) continue;
    if (!matchesModifier(binding, e)) continue;
    if (binding.emit === "drag") {
      setActive(state, binding.action, false);
    }
    if (binding.emit === "click" && wasClick) {
      const at = state.pointerDownAt ?? { x: e.clientX, y: e.clientY };
      emit(state, binding.action, { kind: "pick", clientX: at.x, clientY: at.y });
    }
  }
  state.pointerDownButton = null;
  state.pointerDownAt = null;
  state.pointerDragAccum = 0;
}

function handlePointerMove(state: InternalState, e: PointerEvent): void {
  if (state.pointerDownButton === null) return;
  const deltaX = e.clientX - state.lastPointer.x;
  const deltaY = e.clientY - state.lastPointer.y;
  state.lastPointer = { x: e.clientX, y: e.clientY };
  state.pointerDragAccum += Math.abs(deltaX) + Math.abs(deltaY);
  for (const binding of state.bindings) {
    if (binding.emit !== "drag") continue;
    if (binding.mouseButton !== state.pointerDownButton) continue;
    emit(state, binding.action, { kind: "drag", deltaX, deltaY });
  }
}

function handleWheel(state: InternalState, e: WheelEvent): void {
  for (const binding of state.bindings) {
    if (binding.emit !== "wheel") continue;
    emit(state, binding.action, { kind: "wheel", delta: e.deltaY });
  }
}

function handleContextMenu(e: Event): void {
  // RMB 拖拽不要弹原生菜单
  e.preventDefault();
}

export function createInputManager(options: InputManagerOptions): InputManager {
  const keyboardTarget = options.keyboardTarget ?? window;
  const state: InternalState = {
    bindings: options.bindings ?? DEFAULT_BINDINGS,
    handlers: new Map(),
    activeCodes: new Set(),
    activeActions: new Set(),
    contextStack: [],
    pointerDownButton: null,
    pointerDownAt: null,
    pointerDragAccum: 0,
    lastPointer: { x: 0, y: 0 },
    canvas: options.pointerTarget,
    unbinders: []
  };

  const kd = (e: Event) => handleKeyDown(state, e as KeyboardEvent);
  const ku = (e: Event) => handleKeyUp(state, e as KeyboardEvent);
  const pd = (e: Event) => handlePointerDown(state, e as PointerEvent);
  const pu = (e: Event) => handlePointerUp(state, e as PointerEvent);
  const pm = (e: Event) => handlePointerMove(state, e as PointerEvent);
  const wh = (e: Event) => { (e as WheelEvent).preventDefault(); handleWheel(state, e as WheelEvent); };

  keyboardTarget.addEventListener("keydown", kd);
  keyboardTarget.addEventListener("keyup", ku);
  options.pointerTarget.addEventListener("pointerdown", pd);
  options.pointerTarget.addEventListener("pointerup", pu);
  options.pointerTarget.addEventListener("pointermove", pm);
  options.pointerTarget.addEventListener("wheel", wh, { passive: false });
  options.pointerTarget.addEventListener("contextmenu", handleContextMenu);

  state.unbinders.push(
    () => keyboardTarget.removeEventListener("keydown", kd),
    () => keyboardTarget.removeEventListener("keyup", ku),
    () => options.pointerTarget.removeEventListener("pointerdown", pd),
    () => options.pointerTarget.removeEventListener("pointerup", pu),
    () => options.pointerTarget.removeEventListener("pointermove", pm),
    () => options.pointerTarget.removeEventListener("wheel", wh),
    () => options.pointerTarget.removeEventListener("contextmenu", handleContextMenu)
  );

  return {
    on(action, handler) {
      let set = state.handlers.get(action);
      if (!set) {
        set = new Set();
        state.handlers.set(action, set);
      }
      set.add(handler);
      return () => set?.delete(handler);
    },
    isPressed(action) {
      return state.activeActions.has(action);
    },
    characterKeys() {
      return {
        hasKey(key) {
          // active actions → legacy key 字符串
          for (const action of state.activeActions) {
            const legacy = ACTION_TO_LEGACY_KEY[action];
            if (legacy === key) return true;
          }
          return false;
        },
        asSet() {
          const set = new Set<string>();
          for (const action of state.activeActions) {
            const legacy = ACTION_TO_LEGACY_KEY[action];
            if (legacy) set.add(legacy);
          }
          return set;
        }
      };
    },
    pushContext(name) {
      state.contextStack.push(name);
    },
    popContext(name) {
      const idx = state.contextStack.lastIndexOf(name);
      if (idx >= 0) state.contextStack.splice(idx, 1);
    },
    dispose() {
      for (const unbind of state.unbinders) unbind();
      state.unbinders.length = 0;
      state.handlers.clear();
      state.activeCodes.clear();
      state.activeActions.clear();
    }
  };
}
