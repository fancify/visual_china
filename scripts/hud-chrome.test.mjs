import assert from "node:assert/strict";
import test from "node:test";

import {
  compactHudPanelConfig,
  visibleStatusLineIds
} from "../src/game/hudChrome.js";

test("compact HUD keeps only essential panels open by default", () => {
  assert.equal(compactHudPanelConfig.mode.visible, false);
  assert.equal(compactHudPanelConfig.status.visible, false);
  assert.equal(compactHudPanelConfig.journal.visible, false);
  assert.equal(compactHudPanelConfig.overview.visible, true);
  assert.equal(compactHudPanelConfig.controls.visible, true);
  assert.equal(compactHudPanelConfig.overview.openByDefault, false);
  assert.equal(compactHudPanelConfig.controls.openByDefault, false);
});

test("natural exploration HUD does not pin journey or story lines", () => {
  assert.deepEqual(visibleStatusLineIds, []);
});
