import assert from "node:assert/strict";
import test from "node:test";

import { createInputManager } from "../src/game/input/InputManager.ts";

function keyboardEvent(type, code) {
  const event = new Event(type);
  Object.defineProperty(event, "code", { value: code });
  Object.defineProperty(event, "repeat", { value: false });
  Object.defineProperty(event, "shiftKey", { value: false });
  Object.defineProperty(event, "ctrlKey", { value: false });
  Object.defineProperty(event, "altKey", { value: false });
  Object.defineProperty(event, "metaKey", { value: false });
  Object.defineProperty(event, "preventDefault", { value: () => {} });
  return event;
}

test("InputManager clears movement actions when the window loses focus", () => {
  const previousWindow = globalThis.window;
  const lifecycleTarget = new EventTarget();
  Object.defineProperty(globalThis, "window", {
    value: lifecycleTarget,
    configurable: true
  });

  try {
    const keyboardTarget = new EventTarget();
    const pointerTarget = new EventTarget();
    const input = createInputManager({
      keyboardTarget,
      pointerTarget
    });

    keyboardTarget.dispatchEvent(keyboardEvent("keydown", "KeyW"));
    assert.equal(input.isPressed("move.forward"), true);

    lifecycleTarget.dispatchEvent(new Event("blur"));

    assert.equal(input.isPressed("move.forward"), false);
    assert.equal(input.characterKeys().asSet().has("w"), false);
    input.dispose();
  } finally {
    Object.defineProperty(globalThis, "window", {
      value: previousWindow,
      configurable: true
    });
  }
});

test("InputManager does not activate suppressed movement while a UI context is active", () => {
  const keyboardTarget = new EventTarget();
  const pointerTarget = new EventTarget();
  const input = createInputManager({
    keyboardTarget,
    pointerTarget
  });

  input.pushContext("debugPanel");
  keyboardTarget.dispatchEvent(keyboardEvent("keydown", "KeyW"));

  assert.equal(input.isPressed("move.forward"), false);
  assert.equal(input.characterKeys().asSet().has("w"), false);
  input.dispose();
});
