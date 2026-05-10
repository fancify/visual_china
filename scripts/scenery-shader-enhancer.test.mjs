import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { Color, MeshLambertMaterial, MeshPhongMaterial, Vector2 } from "three";

import {
  attachSceneryShaderEnhancements,
  updateSceneryShaderSeasonal,
  updateSceneryShaderWind
} from "../src/game/sceneryShaderEnhancer.ts";

test("scenery shader enhancer registers shared no-op uniforms on phong and lambert materials", () => {
  const windUniforms = {
    direction: { value: new Vector2(1, 0) },
    strength: { value: 0.5 },
    gust: { value: 0.25 },
    time: { value: 3 },
    noiseScale: { value: 80 }
  };
  const seasonalTint = new Color("#88aa66");
  const materials = [new MeshPhongMaterial(), new MeshLambertMaterial()];

  materials.forEach((material) => {
    attachSceneryShaderEnhancements(material, {
      enableCelShading: false,
      enableRim: true,
      enableWindSway: false,
      enableSeasonalTint: false,
      windUniforms,
      seasonalTint,
      rimStrength: 0.4,
      celBands: 3
    });

    const shader = {
      uniforms: {},
      vertexShader: "#include <common>\nvoid main() {}",
      fragmentShader: "#include <common>\nvoid main() {}"
    };
    material.onBeforeCompile(shader);

    assert.equal(shader.uniforms.uSceneryEnableCelShading.value, 0);
    assert.equal(shader.uniforms.uSceneryEnableRim.value, 1);
    assert.equal(shader.uniforms.uSceneryEnableWindSway.value, 0);
    assert.equal(shader.uniforms.uSceneryEnableSeasonalTint.value, 0);
    assert.equal(shader.uniforms.uSceneryRimStrength.value, 0.4);
    assert.equal(shader.uniforms.uSceneryCelBands.value, 3);
    assert.deepEqual(shader.uniforms.uScenerySeasonalTint.value.toArray(), seasonalTint.toArray());
    assert.deepEqual(shader.uniforms.uSceneryWindDirection.value.toArray(), [1, 0]);
    assert.equal(shader.uniforms.uSceneryWindStrength.value, 0.5);
    assert.equal(shader.uniforms.uSceneryWindGust.value, 0.25);
    assert.equal(shader.uniforms.uSceneryWindTime.value, 3);
    assert.equal(shader.uniforms.uSceneryWindNoiseScale.value, 80);

    assert.equal(shader.vertexShader, "#include <common>\nvoid main() {}");
    assert.equal(shader.fragmentShader, "#include <common>\nvoid main() {}");
  });
});

test("scenery shader updater pushes wind and seasonal uniforms after compile", () => {
  const material = new MeshPhongMaterial();
  attachSceneryShaderEnhancements(material, {
    enableCelShading: false,
    enableRim: false,
    enableWindSway: false,
    enableSeasonalTint: false
  });
  const shader = {
    uniforms: {},
    vertexShader: "#include <common>",
    fragmentShader: "#include <common>"
  };
  material.onBeforeCompile(shader);

  updateSceneryShaderWind(material, {
    direction: { value: new Vector2(0, 1) },
    strength: { value: 0.9 },
    gust: { value: 0.3 },
    time: { value: 12 },
    noiseScale: { value: 64 }
  });
  updateSceneryShaderSeasonal(material, new Color("#abcdef"));

  assert.deepEqual(shader.uniforms.uSceneryWindDirection.value.toArray(), [0, 1]);
  assert.equal(shader.uniforms.uSceneryWindStrength.value, 0.9);
  assert.equal(shader.uniforms.uSceneryWindGust.value, 0.3);
  assert.equal(shader.uniforms.uSceneryWindTime.value, 12);
  assert.equal(shader.uniforms.uSceneryWindNoiseScale.value, 64);
  assert.deepEqual(shader.uniforms.uScenerySeasonalTint.value.toArray(), new Color("#abcdef").toArray());
});

test("grass wind shader applies per-instance circular fade around the player", () => {
  const material = new MeshPhongMaterial();
  attachSceneryShaderEnhancements(material, {
    enableCelShading: false,
    enableRim: false,
    enableWindSway: true,
    enableSeasonalTint: false,
    enableGrassDistanceFade: true
  });
  const shader = {
    uniforms: {},
    vertexShader: "#include <common>\n#include <begin_vertex>",
    fragmentShader: "#include <common>\n#include <color_fragment>"
  };
  material.onBeforeCompile(shader);

  assert.equal(shader.uniforms.uSceneryGrassFadeStart.value, 40);
  assert.equal(shader.uniforms.uSceneryGrassFadeEnd.value, 50);
  assert.match(shader.vertexShader, /sceneryGrassFade/);
  assert.match(shader.vertexShader, /smoothstep\(uSceneryGrassFadeStart, uSceneryGrassFadeEnd, sceneryPlayerDist\)/);
  assert.match(shader.vertexShader, /transformed\.y -= 100\.0 \* \(1\.0 - sceneryGrassFade\)/);
  assert.match(shader.fragmentShader, /diffuseColor\.a \*= vSceneryGrassFade/);
});

test("R8 wires scenery shader enhancer into scenery, wildlife, city, and avatar materials", async () => {
  const [scenery, wildlife, cityMarkers, playerAvatarMesh] = await Promise.all([
    readFile(new URL("../src/game/scenery.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/game/wildlife.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/game/cityMarkers.ts", import.meta.url), "utf8"),
    readFile(new URL("../src/game/playerAvatarMesh.ts", import.meta.url), "utf8")
  ]);

  assert.match(scenery, /attachSceneryShaderEnhancements\(sharedTreeMaterial/);
  assert.match(wildlife, /attachSceneryShaderEnhancements\(material/);
  assert.match(cityMarkers, /attachSceneryShaderEnhancements\(material/);
  assert.match(playerAvatarMesh, /attachPlayerSceneryShaderEnhancements/);
});

test("main no longer toggles grass by chunk-center distance", async () => {
  const main = await readFile(new URL("../src/main.ts", import.meta.url), "utf8");

  assert.doesNotMatch(main, /grassVisible\s*=\s*sceneryVisible\s*&&\s*chunkDistance\s*<=\s*50/);
});
