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
