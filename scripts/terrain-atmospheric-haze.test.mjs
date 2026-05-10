import assert from "node:assert/strict";
import test from "node:test";
import { Color, MeshPhongMaterial } from "three";

import {
  attachTerrainShaderEnhancements,
  terrainAtmosphericHazeDefaults
} from "../src/game/terrainShaderEnhancer.ts";
import {
  sharedAtmosphericFarColor
} from "../src/game/environment.ts";

test("terrain atmospheric haze defaults — Claude calibrated post-Playwright review", () => {
  // R6：用户实测远景/地平线 fade 不明显，收窄 ramp 并提高 strength。
  assert.equal(terrainAtmosphericHazeDefaults.startDistance, 60);
  assert.equal(terrainAtmosphericHazeDefaults.endDistance, 200);
  assert.equal(terrainAtmosphericHazeDefaults.strength, 0.75);
});

test("terrain shader computes LOD morph per vertex and steepens atmospheric fade", () => {
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

  // R10a-fix: morph 推到 60-120u (scenery spawn radius 50u 之外)
  assert.equal(shader.uniforms.uMorphStart.value, 60);
  assert.equal(shader.uniforms.uMorphEnd.value, 120);
  assert.match(shader.vertexShader, /uniform float uMorphStart;/);
  assert.match(shader.vertexShader, /uniform float uMorphEnd;/);
  assert.match(shader.vertexShader, /distance\(cameraPosition\.xz, worldPos\.xz\)/);
  assert.match(shader.vertexShader, /smoothstep\(uMorphStart, uMorphEnd, vDist\)/);
  assert.doesNotMatch(
    shader.vertexShader,
    /mix\(positionLod0\.y, positionLod1\.y, clamp\(uTerrainLodMorph/
  );
  assert.match(shader.fragmentShader, /pow\(atmosphericT, 0\.7\)/);
});

test("shared atmospheric far color follows the sky horizon color without zenith or stone-blue tinting", () => {
  const skyHorizonColor = new Color("#b6c4be");
  const farColor = sharedAtmosphericFarColor({ skyHorizonColor });

  assert.notEqual(farColor, skyHorizonColor, "callers should receive a clone they can mutate");
  assert.ok(
    farColor.equals(skyHorizonColor),
    "terrain/cloud/mountain far color should use the same horizon color as the sky shader"
  );

  farColor.set("#000000");
  assert.ok(
    skyHorizonColor.equals(new Color("#b6c4be")),
    "mutating the shared far color clone must not mutate environment visuals"
  );
});
