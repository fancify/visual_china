import assert from "node:assert/strict";
import test from "node:test";

let createAudioDebugHud;

try {
  ({ createAudioDebugHud } = await import("../src/game/audioDebugHud.ts"));
} catch {
  createAudioDebugHud = undefined;
}

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

  contains(token) {
    return this.tokens.has(token);
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

  remove() {
    if (!this.parentNode) {
      return;
    }
    const index = this.parentNode.children.indexOf(this);
    if (index >= 0) {
      this.parentNode.children.splice(index, 1);
    }
    this.parentNode = null;
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

test("audio debug hud renders active layers and recent fires", () => {
  const previousDocument = globalThis.document;
  globalThis.document = new FakeDocument();

  try {
    assert.equal(typeof createAudioDebugHud, "function");
    const root = new FakeElement("div");
    const hud = createAudioDebugHud(root);

    hud.setVisible(true);
    hud.refresh({
      activeLayers: [
        {
          trackId: "ambient_stream_water",
          currentGain: 0.42,
          triggerLabel: "river-proximity=0.70"
        },
        {
          trackId: "ambient_forest_birds",
          currentGain: 0.6,
          triggerLabel: "biome=forest, day"
        }
      ],
      recentFires: [
        {
          id: "ui_hover",
          ts: 97.2,
          reason: "hover POI: 黄龙"
        },
        {
          id: "footstep_grass",
          ts: 95,
          reason: "footstep:grass"
        }
      ],
      nowSec: 100,
      masterGainValue: 0.25
    });

    assert.equal(root.children.length, 1);
    const panel = root.children[0];
    assert.match(panel.innerHTML, /环境音 \(0\.25\)/);
    assert.match(panel.innerHTML, /ambient_stream_water/);
    assert.match(panel.innerHTML, /0\.42/);
    assert.match(panel.innerHTML, /river-proximity=0\.70/);
    assert.match(panel.innerHTML, /ambient_forest_birds/);
    assert.match(panel.innerHTML, /2\.8s ui_hover/);
    assert.match(panel.innerHTML, /hover POI: 黄龙/);
    assert.match(panel.innerHTML, /5\.0s footstep_grass/);
  } finally {
    globalThis.document = previousDocument;
  }
});

test("audio debug hud toggle switches visible class", () => {
  const previousDocument = globalThis.document;
  globalThis.document = new FakeDocument();

  try {
    assert.equal(typeof createAudioDebugHud, "function");
    const root = new FakeElement("div");
    const hud = createAudioDebugHud(root);
    const panel = root.children[0];

    assert.equal(panel.classList.contains("audio-debug-hud-visible"), false);
    assert.equal(panel.hidden, true);

    hud.toggle();
    assert.equal(panel.classList.contains("audio-debug-hud-visible"), true);
    assert.equal(panel.hidden, false);

    hud.toggle();
    assert.equal(panel.classList.contains("audio-debug-hud-visible"), false);
    assert.equal(panel.hidden, true);
  } finally {
    globalThis.document = previousDocument;
  }
});
