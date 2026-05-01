import assert from "node:assert/strict";
import test from "node:test";

import {
  compactHudPanelConfig,
  visibleStatusLineIds
} from "../src/game/hudChrome.js";

test("compact HUD keeps only essential panels open by default", () => {
  assert.equal(compactHudPanelConfig.mode.openByDefault, false);
  assert.equal(compactHudPanelConfig.overview.openByDefault, false);
  assert.equal(compactHudPanelConfig.controls.openByDefault, false);
  assert.equal(compactHudPanelConfig.status.openByDefault, true);
});

test("compact HUD status hides secondary telemetry until expanded", () => {
  assert.deepEqual(visibleStatusLineIds, ["zone-line", "story-line"]);
});
