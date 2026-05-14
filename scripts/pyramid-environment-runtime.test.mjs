import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {
  AmbientLight,
  Color,
  DirectionalLight,
  FogExp2,
  PerspectiveCamera,
  Scene,
  Vector3
} from "three";

import { createPyramidEnvironmentRuntime } from "../src/game/terrain/pyramidEnvironmentRuntime.ts";

test("pyramid environment runtime adapts Line B visuals without importing main.ts", () => {
  const source = fs.readFileSync(
    new URL("../src/game/terrain/pyramidEnvironmentRuntime.ts", import.meta.url),
    "utf8"
  );
  assert.doesNotMatch(source, /main\.ts|\.\/main|main\.js/);

  const scene = new Scene();
  const camera = new PerspectiveCamera();
  const ambientLight = new AmbientLight(0xffffff, 0);
  const sunLight = new DirectionalLight(0xffffff, 0);
  const fog = new FogExp2(0x000000, 0);
  const clearColors = [];
  const waterDirections = [];

  const runtime = createPyramidEnvironmentRuntime({
    scene,
    renderer: {
      setClearColor(color) {
        clearColors.push(color.clone());
      }
    },
    camera,
    ambientLight,
    sunLight,
    fog,
    waterSurfaces: [
      {
        setSunDirection(direction) {
          waterDirections.push(direction.clone());
        }
      }
    ],
    enableSkyDome: false
  });

  const beforeSun = sunLight.position.clone();
  const visuals = runtime.update(1 / 60);

  assert.ok(scene.background instanceof Color);
  assert.ok(clearColors.length >= 2);
  assert.ok(ambientLight.intensity > 0);
  assert.ok(sunLight.intensity >= 0);
  assert.notDeepEqual(sunLight.position.toArray(), beforeSun.toArray());
  assert.ok(fog.density > 0);
  assert.ok(waterDirections.at(-1) instanceof Vector3);
  assert.equal(waterDirections.at(-1).toArray().join(","), visuals.sunDirection.toArray().join(","));
  assert.match(runtime.statusText(), /时辰 .* · .* · ./);
});
