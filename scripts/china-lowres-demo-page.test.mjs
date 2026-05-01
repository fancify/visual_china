import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("standalone China lowres game demo page loads the lowres DEM module", () => {
  const html = fs.readFileSync("china-lowres.html", "utf8");
  const entry = fs.readFileSync("src/chinaLowresDemo.ts", "utf8");

  assert.match(html, /chinaLowresDemo\.ts/);
  assert.match(entry, /\/data\/china-lowres-dem\.json/);
  assert.match(entry, /heightScale/);
  assert.match(entry, /state\.yaw = 0/);
  assert.match(entry, /const mapZ = -z/);
  assert.match(entry, /requestAnimationFrame/);
});
