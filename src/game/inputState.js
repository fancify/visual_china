const GAMEPLAY_KEYS = new Set([
  "w",
  "a",
  "s",
  "d",
  "arrowup",
  "arrowdown",
  "arrowleft",
  "arrowright",
  "q",
  "e",
  "shift"
]);

// 物理按键 code → 游戏按键名映射。在中文输入法激活时 event.key 不再是 'q'，
// 但 event.code 始终是 'KeyQ'（物理按键，不受 IME 影响）。这是 macOS 中文用户
// 反馈"按 Q 没反应"的根因。
const KEY_CODE_MAP = {
  KeyW: "w",
  KeyA: "a",
  KeyS: "s",
  KeyD: "d",
  KeyQ: "q",
  KeyE: "e",
  KeyK: "k",
  KeyL: "l",
  KeyT: "t",
  KeyM: "m",
  KeyO: "o",
  KeyF: "f",
  KeyI: "i",
  KeyJ: "j",
  KeyP: "p",
  // 坐骑 / 造型 切换：[ ] 切坐骑，- = 切造型。两组都用 event.code（IME-safe）。
  BracketLeft: "[",
  BracketRight: "]",
  Minus: "-",
  Equal: "=",
  ArrowUp: "arrowup",
  ArrowDown: "arrowdown",
  ArrowLeft: "arrowleft",
  ArrowRight: "arrowright",
  ShiftLeft: "shift",
  ShiftRight: "shift",
  Space: " ",
  Escape: "escape"
};

/**
 * 把 KeyboardEvent 或字符串归一化成内部按键标识。
 * 优先用 event.code（不受 IME 影响），fallback 到 event.key.toLowerCase()。
 */
export function normalizeInputKey(eventOrKey) {
  if (typeof eventOrKey === "string") {
    return eventOrKey.toLowerCase();
  }
  // KeyboardEvent
  const fromCode = KEY_CODE_MAP[eventOrKey.code];
  if (fromCode !== undefined) {
    return fromCode;
  }
  return (eventOrKey.key ?? "").toLowerCase();
}

export function isGameplayInputKey(eventOrKey) {
  return GAMEPLAY_KEYS.has(normalizeInputKey(eventOrKey));
}

export function movementAxesFromKeys(keys) {
  let forward = 0;
  let right = 0;

  if (keys.has("w") || keys.has("arrowup")) {
    forward += 1;
  }
  if (keys.has("s") || keys.has("arrowdown")) {
    forward -= 1;
  }
  if (keys.has("a") || keys.has("arrowleft")) {
    right -= 1;
  }
  if (keys.has("d") || keys.has("arrowright")) {
    right += 1;
  }

  return { forward, right };
}

export function clearGameplayInput(keys) {
  keys.clear();
  return keys;
}
