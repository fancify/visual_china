import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("standalone China lowres game demo page loads the lowres DEM module", () => {
  const html = fs.readFileSync("china-lowres.html", "utf8");
  const entry = fs.readFileSync("src/chinaLowresDemo.ts", "utf8");

  assert.match(html, /chinaLowresDemo\.ts/);
  assert.match(entry, /\/data\/china-lowres-dem\.json/);
  assert.match(entry, /heightScale/);
  // 新 mapOrientation 契约：北 = -Z 与 Three.js 默认相机 forward 对齐。
  // yaw=0 让相机默认朝向 = 看北，屏幕远端 = 北。
  assert.match(entry, /state\.yaw = 0/);
  // 不允许用 mapZ = -z 翻转 sampler 输入。
  assert.doesNotMatch(entry, /const\s+mapZ\s*=\s*-\s*z/);
  assert.match(entry, /requestAnimationFrame/);
});
