import assert from "node:assert/strict";
import test from "node:test";
import {
  Mesh,
  MeshBasicMaterial,
  OrthographicCamera,
  PlaneGeometry,
  Raycaster,
  Vector2
} from "three";

import {
  createCityHoverHud,
  findNearestProximityPoi,
  reduceHudTarget,
  toggleHudDetailState
} from "../src/game/cityHoverHud.ts";
import {
  attachHoverPoiMetadata,
  findHoveredPoiFromIntersections
} from "../src/game/poiHoverRuntime.ts";

function buildPoi({
  id = "poi-a",
  name = "测试地标",
  category = "scenic",
  worldX = 0,
  worldZ = 0,
  elevation = 1234,
  realLat = 34,
  realLon = 108,
  description = "测试描述"
} = {}) {
  return {
    id,
    name,
    category,
    worldX,
    worldZ,
    elevation,
    realLat,
    realLon,
    description
  };
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
    this.dataset = {};
    this.innerHTML = "";
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
    this.children.push(child);
    return child;
  }
}

class FakeDocument {
  createElement(tagName) {
    return new FakeElement(tagName);
  }
}

test("findHoveredPoiFromIntersections returns attached metadata POI from raycaster hit", () => {
  const poi = buildPoi();
  const mesh = new Mesh(new PlaneGeometry(2, 2), new MeshBasicMaterial());
  mesh.position.z = -2;
  attachHoverPoiMetadata(mesh, poi);

  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
  camera.position.z = 0;
  camera.lookAt(0, 0, -2);
  camera.updateMatrixWorld(true);

  const raycaster = new Raycaster();
  raycaster.setFromCamera(new Vector2(0, 0), camera);
  const intersections = raycaster.intersectObject(mesh, false);

  const hovered = findHoveredPoiFromIntersections(intersections);
  assert.equal(intersections.length > 0, true);
  assert.equal(hovered?.id, poi.id);
});

test("findNearestProximityPoi returns POI within 1u radius", () => {
  const poi = buildPoi({ id: "nearby-poi", worldX: 1, worldZ: 0 });

  const nearest = findNearestProximityPoi(0, 0, [poi], () => 1.1);

  assert.equal(nearest?.id, poi.id);
});

test("setTarget renders compact HUD card and hide clears it", () => {
  const previousDocument = globalThis.document;
  globalThis.document = new FakeDocument();

  try {
    const root = new FakeElement("div");
    const hud = createCityHoverHud(root, {
      getPlayerWorldPosition: () => ({ x: 0, z: 0 })
    });
    const poi = buildPoi({ id: "hud-poi", name: "太白关" });

    hud.setTarget(poi, "hover");

    assert.equal(root.children.length, 1);
    const hoverCard = root.children[0];
    assert.equal(hud.getCurrentTargetId(), poi.id);
    assert.equal(hud.getCurrentState(), "compact");
    assert.equal(hoverCard.classList.contains("hud-hover-card-hidden"), false);
    assert.equal(hoverCard.classList.contains("hud-hover-card-compact"), true);
    assert.match(hoverCard.innerHTML, /太白关/);
    assert.match(hoverCard.innerHTML, /按 i 查看详情/);

    hud.setTarget(null, null);

    assert.equal(hud.getCurrentTargetId(), null);
    assert.equal(hud.getCurrentState(), "hidden");
    assert.equal(hoverCard.classList.contains("hud-hover-card-hidden"), true);
    assert.equal(hoverCard.innerHTML, "");
  } finally {
    globalThis.document = previousDocument;
  }
});

test("same target returning from detail via hover resets to compact", () => {
  const poi = buildPoi({ id: "same-poi" });

  const proximityCompact = reduceHudTarget(
    { target: null, source: null, state: "hidden" },
    poi,
    "proximity"
  );
  const detail = toggleHudDetailState(proximityCompact);
  const hoverUpdate = reduceHudTarget(detail, poi, "hover");

  assert.equal(proximityCompact.state, "compact");
  assert.equal(detail.state, "detail");
  assert.equal(hoverUpdate.source, "hover");
  assert.equal(hoverUpdate.state, "compact");
});
