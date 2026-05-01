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

export function normalizeInputKey(key) {
  return key.toLowerCase();
}

export function isGameplayInputKey(key) {
  return GAMEPLAY_KEYS.has(normalizeInputKey(key));
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
