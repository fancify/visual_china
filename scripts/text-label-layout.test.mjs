import assert from "node:assert/strict";
import test from "node:test";

import { textSpriteLayout } from "../src/game/textLabel.js";

test("text sprite labels allocate wider canvases for longer Chinese names", () => {
  const shortLabel = textSpriteLayout("陈仓道");
  const longLabel = textSpriteLayout("金牛道/剑门蜀道");

  assert.ok(longLabel.canvasWidth > shortLabel.canvasWidth);
  assert.ok(longLabel.rect.width > 0);
  assert.ok(longLabel.scale.x > shortLabel.scale.x);
});

test("text sprite labels preserve padding so text is not clipped by the canvas edge", () => {
  const layout = textSpriteLayout("褒斜谷意象");

  assert.ok(layout.text.x > layout.rect.x);
  assert.ok(layout.text.x < layout.rect.x + layout.rect.width);
  assert.ok(layout.text.y > layout.rect.y);
  assert.ok(layout.text.y < layout.rect.y + layout.rect.height);
});
