import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  compactHudPanelConfig,
  visibleStatusLineIds
} from "../src/game/hudChrome.js";
import { createAudioDebugHud } from "../src/game/audioDebugHud.ts";

class FakeClassList {
  constructor(owner) {
    this.owner = owner;
    this.tokens = new Set();
  }

  setFromClassName(value) {
    this.tokens = new Set(value.split(/\s+/).filter(Boolean));
    this.owner._className = Array.from(this.tokens).join(" ");
  }

  toggle(token, force) {
    if (force === undefined) {
      if (this.tokens.has(token)) {
        this.tokens.delete(token);
      } else {
        this.tokens.add(token);
      }
    } else if (force) {
      this.tokens.add(token);
    } else {
      this.tokens.delete(token);
    }
    this.owner._className = Array.from(this.tokens).join(" ");
  }
}

class FakeElement {
  constructor(tagName) {
    this.tagName = tagName.toUpperCase();
    this.children = [];
    this.parentNode = null;
    this.hidden = false;
    this.innerHTML = "";
    this.textContent = "";
    this.id = "";
    this._className = "";
    this.classList = new FakeClassList(this);
  }

  set className(value) {
    this.classList.setFromClassName(value);
  }

  get className() {
    return this._className;
  }

  appendChild(child) {
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
}

class FakeDocument {
  constructor() {
    this.head = new FakeElement("head");
    this.body = new FakeElement("body");
  }

  createElement(tagName) {
    return new FakeElement(tagName);
  }

  querySelector(selector) {
    if (!selector.startsWith("#")) {
      return null;
    }
    const id = selector.slice(1);
    return [...this.head.children, ...this.body.children].find(
      (child) => child.id === id
    ) ?? null;
  }
}

const styleCss = readFileSync(new URL("../src/style.css", import.meta.url), "utf8");

test("compact HUD keeps only essential panels open by default", () => {
  assert.equal(compactHudPanelConfig.mode.visible, false);
  // 用户："右下角的当前旅程可以去掉了" → status.visible = false
  assert.equal(compactHudPanelConfig.status.visible, false);
  assert.equal(compactHudPanelConfig.journal.visible, false);
  assert.equal(compactHudPanelConfig.overview.visible, true);
  // 用户："操作提示也可以去掉" → controls.visible = false
  assert.equal(compactHudPanelConfig.controls.visible, false);
  // 用户："右上角小地图默认展开" → overview.openByDefault = true
  assert.equal(compactHudPanelConfig.overview.openByDefault, true);
  assert.equal(compactHudPanelConfig.controls.openByDefault, false);
  assert.equal(compactHudPanelConfig.status.openByDefault, false);
});

test("natural exploration HUD does not pin journey or story lines", () => {
  assert.deepEqual(visibleStatusLineIds, []);
});

test("HUD chrome layout separates right stack, status card, and hover card anchors", () => {
  assert.match(
    styleCss,
    /\.overview-block\s*\{[^}]*right:\s*18px;[^}]*top:\s*18px;[^}]*\}/s
  );
  assert.match(
    styleCss,
    /\.audio-mute-toggle\s*\{[^}]*top:\s*72px;[^}]*right:\s*18px;[^}]*\}/s
  );
  assert.match(
    styleCss,
    /\.mode-block\s*\{[^}]*right:\s*18px;[^}]*top:\s*50%;[^}]*transform:\s*translateY\(-50%\);[^}]*\}/s
  );
  assert.match(
    styleCss,
    /\.status-block\s*\{[^}]*left:\s*auto;[^}]*right:\s*18px;[^}]*bottom:\s*18px;[^}]*\}/s
  );
  assert.match(
    styleCss,
    /\.hud-hover-card\s*\{[^}]*left:\s*50%;[^}]*bottom:\s*18px;[^}]*transform:\s*translateX\(-50%\);[^}]*\}/s
  );
  assert.match(
    styleCss,
    /\.controls-block\s*\{[^}]*right:\s*18px;[^}]*bottom:\s*172px;[^}]*\}/s
  );
});

test("audio debug HUD drops below the mute button stack", () => {
  const previousDocument = globalThis.document;
  globalThis.document = new FakeDocument();

  try {
    createAudioDebugHud(new FakeElement("div"));
    assert.equal(globalThis.document.head.children.length, 1);
    const injectedStyle = globalThis.document.head.children[0].textContent;
    assert.match(
      injectedStyle,
      /\.audio-debug-hud\s*\{[^}]*top:\s*126px;[^}]*right:\s*18px;[^}]*\}/s
    );
  } finally {
    globalThis.document = previousDocument;
  }
});
