import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Color, MeshPhongMaterial, Vector2 } from "three";

import {
  attachTerrainShaderEnhancements
} from "../src/game/terrainShaderEnhancer.ts";
import { WindManager } from "../src/game/windManager.ts";

test("WindManager accumulates time and publishes weather wind state through shared uniforms", () => {
  const manager = new WindManager();
  const initialDirection = manager.uniforms.direction.value.clone();

  manager.update(0.5, {
    wind: 0.72,
    gust: 0.35,
    direction: new Vector2(0, 1)
  });
  manager.update(0.25, {});

  assert.equal(manager.uniforms.time.value, 0.75);
  assert.equal(manager.uniforms.strength.value, 0.4);
  assert.equal(manager.uniforms.gust.value, 0);
  assert.deepEqual(manager.uniforms.direction.value.toArray(), [0, 1]);
  assert.notDeepEqual(initialDirection.toArray(), manager.uniforms.direction.value.toArray());
});

test("terrain shader injects world-space scrolling cloud cookie uniforms and math before atmospheric haze", () => {
  const material = new MeshPhongMaterial();
  attachTerrainShaderEnhancements(material, {
    heightFogColor: new Color("#b6c4be"),
    atmosphericFarColor: new Color("#b6c4be")
  });

  const shader = {
    uniforms: {},
    vertexShader: `
      #include <common>
      void main() {
        #include <begin_vertex>
        #include <fog_vertex>
      }
    `,
    fragmentShader: `
      #include <common>
      void main() {
        vec3 outgoingLight = vec3(1.0);
        #include <output_fragment>
      }
    `
  };

  material.onBeforeCompile(shader);

  assert.ok(shader.uniforms.uCloudCookie);
  assert.ok(shader.uniforms.uWindDirection);
  assert.ok(shader.uniforms.uWindStrength);
  assert.ok(shader.uniforms.uWindTime);
  // R7.1 (Claude post-Playwright tune): 视野只 ~70u 时 200u tile 看不到 contrast，
  // strength 0.35 + uWindStrength 0.4 倍率把云影压到 7% (看不见)。改 80u tile / 0.5 strength /
  // 0.05 速度 / 阈值 0.35→0.65 + 移除 uWindStrength 倍率。
  assert.equal(shader.uniforms.uCloudCookieScale.value, 80);
  assert.equal(shader.uniforms.uCloudCookieStrength.value, 0.5);

  assert.match(shader.fragmentShader, /uniform sampler2D uCloudCookie;/);
  assert.match(shader.fragmentShader, /vWorldPosition\.xz \/ uCloudCookieScale/);
  assert.match(shader.fragmentShader, /uWindDirection \* uWindTime \* 0\.05/);
  assert.match(shader.fragmentShader, /texture2D\(uCloudCookie, cookieUV\)\.r/);
  assert.match(shader.fragmentShader, /smoothstep\(0\.35, 0\.65, cookieValue\)/);
  assert.match(shader.fragmentShader, /outgoingLight \*= \(1\.0 - shadowFactor\)/);
  assert.ok(
    shader.fragmentShader.indexOf("outgoingLight *= (1.0 - shadowFactor)") <
      shader.fragmentShader.indexOf("R6 大气透视"),
    "cloud cookie must darken terrain before atmospheric haze fades distant terrain"
  );
});

test("main render loop wires WindManager and terrain cloud-cookie uniforms without taking over sky cloud drift", async () => {
  const mainSource = await readFile(new URL("../src/main.ts", import.meta.url), "utf8");

  assert.match(mainSource, /const windManager = new WindManager\(\);/);
  assert.match(mainSource, /windManager\.update\(deltaSeconds, environmentController\.getWindState\(\)\)/);
  assert.match(mainSource, /createCloudCookieTexture\(/);
  assert.match(mainSource, /updateTerrainShaderCloudCookie\(/);
  assert.match(mainSource, /cloudDrift \+= deltaSeconds \* visuals\.cloudDriftSpeed \* 12/);
});
