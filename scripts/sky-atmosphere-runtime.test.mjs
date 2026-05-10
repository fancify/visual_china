import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

function luminance(color) {
  return color.r * 0.2126 + color.g * 0.7152 + color.b * 0.0722;
}

async function loadGameModules() {
  const tempRoot = path.resolve(".codex-temp-tests");
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(path.join(tempRoot, "sky-atmosphere-"));
  const sourceDir = path.resolve("src/game");
  const transpileTargets = [
    "atmosphereLayer.ts",
    "cloudPlanes.ts",
    "environment.ts",
    "proceduralTextures.ts"
  ];
  const copyTargets = ["skyDome.js", "celestial.js"];

  for (const fileName of transpileTargets) {
    const source = await readFile(path.join(sourceDir, fileName), "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022
      },
      fileName
    });
    const rewritten = output.outputText.replace(/from "(\.\/[^"]+)";/g, (_match, specifier) => {
      return specifier.endsWith(".js")
        ? `from "${specifier}";`
        : `from "${specifier}.js";`;
    });
    await writeFile(
      path.join(tempDir, fileName.replace(/\.ts$/, ".js")),
      rewritten,
      "utf8"
    );
  }

  for (const fileName of copyTargets) {
    await copyFile(path.join(sourceDir, fileName), path.join(tempDir, fileName));
  }

  const atmosphereLayer = await import(
    `${new URL(`file://${path.join(tempDir, "atmosphereLayer.js")}`).href}?v=${Date.now()}`
  );
  const environment = await import(
    `${new URL(`file://${path.join(tempDir, "environment.js")}`).href}?v=${Date.now()}`
  );
  await rm(tempDir, { recursive: true, force: true });

  return { atmosphereLayer, environment };
}

function installCanvasStub() {
  const originalDocument = globalThis.document;

  const createGradient = () => ({
    addColorStop() {}
  });

  const context = {
    fillStyle: "",
    strokeStyle: "",
    lineWidth: 0,
    globalCompositeOperation: "source-over",
    createRadialGradient: createGradient,
    createLinearGradient: createGradient,
    createImageData(width, height) {
      return {
        width,
        height,
        data: new Uint8ClampedArray(width * height * 4)
      };
    },
    fillRect() {},
    clearRect() {},
    beginPath() {},
    arc() {},
    fill() {},
    stroke() {},
    ellipse() {},
    clip() {},
    save() {},
    restore() {},
    moveTo() {},
    closePath() {},
    putImageData() {}
  };

  globalThis.document = {
    createElement(tagName) {
      assert.equal(tagName, "canvas");
      return {
        width: 0,
        height: 0,
        getContext(type) {
          assert.equal(type, "2d");
          return context;
        }
      };
    }
  };

  return () => {
    if (originalDocument === undefined) {
      delete globalThis.document;
      return;
    }
    globalThis.document = originalDocument;
  };
}

test("night sky keeps horizon darker than zenith and twilight warms the horizon more than the zenith", async () => {
  const { environment } = await loadGameModules();
  const controller = new environment.EnvironmentController();

  controller.state.timeOfDay = 23;
  const nightVisuals = controller.computeVisuals();
  assert.ok(
    luminance(nightVisuals.skyHorizonColor) <= luminance(nightVisuals.skyZenithColor),
    "night horizon should stay darker than the upper sky"
  );

  controller.state.timeOfDay = 18;
  const duskVisuals = controller.computeVisuals();
  assert.ok(duskVisuals.twilightStrength > 0.7);
  assert.ok(
    duskVisuals.skyHorizonColor.r > duskVisuals.skyZenithColor.r,
    "twilight horizon should carry warmer red than zenith"
  );
});

test("twilight keeps the cool-side horizon no brighter than the zenith while noon and midnight stay on their current ramps", async () => {
  const { environment } = await loadGameModules();
  const controller = new environment.EnvironmentController();

  const sample = (timeOfDay) => {
    controller.state.timeOfDay = timeOfDay;
    const visuals = controller.computeVisuals();
    return {
      visuals,
      coolLum: luminance(visuals.skyHorizonCoolColor),
      horizonLum: luminance(visuals.skyHorizonColor),
      zenithLum: luminance(visuals.skyZenithColor)
    };
  };

  const dusk = sample(18.5);
  assert.ok(dusk.visuals.twilightStrength > 0.7);
  assert.ok(
    dusk.coolLum <= dusk.zenithLum,
    "dusk cool-side horizon should not outrun the zenith brightness"
  );

  const dawn = sample(5.5);
  assert.ok(dawn.visuals.twilightStrength > 0.7);
  assert.ok(
    dawn.coolLum <= dawn.zenithLum,
    "dawn cool-side horizon should not outrun the zenith brightness"
  );

  const noon = sample(12);
  assert.equal(noon.visuals.twilightStrength, 0);
  assert.ok(
    Math.abs(noon.coolLum - noon.horizonLum) < 1e-9,
    "noon cool-side horizon should stay identical to the base horizon ramp"
  );
  assert.ok(noon.coolLum > noon.zenithLum, "noon horizon should stay brighter than the zenith");

  const midnight = sample(0);
  assert.equal(midnight.visuals.twilightStrength, 0);
  assert.ok(
    Math.abs(midnight.coolLum - midnight.horizonLum) < 1e-9,
    "midnight cool-side horizon should stay identical to the base horizon ramp"
  );
  assert.ok(
    midnight.coolLum <= midnight.zenithLum,
    "midnight horizon should stay darker than the zenith"
  );
});

test("sun and moon horizon fade stay full at the horizon and only collapse after sinking below it", async () => {
  const { environment } = await loadGameModules();

  assert.ok(
    environment.skyBodyHorizonFade(0) >= 0.95,
    "disc fade should stay effectively full at the horizon"
  );
  assert.ok(
    environment.skyBodyHorizonFade(-0.04) >= 0.99,
    "disc fade should stay full while the center has only just dipped below the horizon"
  );
  assert.ok(
    environment.skyBodyHorizonFade(-0.14) <= 0.01,
    "disc fade should collapse once the body is meaningfully below the horizon"
  );
});

test("twilight boosts sun disc opacity so sunset keeps a readable disc", async () => {
  const { environment } = await loadGameModules();
  const controller = new environment.EnvironmentController();

  controller.state.timeOfDay = 18;
  const dusk = controller.computeVisuals();

  assert.ok(dusk.twilightStrength > 0.7);
  assert.ok(dusk.sunDiscOpacity >= 0.4, "sunset sun disc should stay readable through twilight");
});

test("environment maps the sun across an east-noon-west arc and exposes the synodic moon phase", async () => {
  const { environment } = await loadGameModules();
  const controller = new environment.EnvironmentController();

  controller.state.dayOfYear = 0;
  controller.state.timeOfDay = 6;
  const sunrise = controller.computeVisuals();
  assert.ok(sunrise.sunDirection.x > 70, "sunrise sun should emerge from +X/east");
  assert.ok(Math.abs(sunrise.sunDirection.z) < 1e-6, "sunrise sun should stay on the east-west arc");

  controller.state.timeOfDay = 12;
  const noon = controller.computeVisuals();
  assert.ok(Math.abs(noon.sunDirection.x) < 1e-6, "noon sun should sit on the meridian");
  assert.ok(noon.sunDirection.y > 150, "noon sun should climb near the zenith");

  controller.state.timeOfDay = 18;
  const sunset = controller.computeVisuals();
  assert.ok(sunset.sunDirection.x < -70, "sunset sun should fall toward -X/west");
  assert.ok(Math.abs(sunset.sunDirection.z) < 1e-6, "sunset sun should stay on the east-west arc");

  controller.state.timeOfDay = 0;
  const midnight = controller.computeVisuals();
  assert.ok(midnight.sunDirection.y < 0, "midnight sun should stay below the horizon");

  controller.state.dayOfYear = 14.75;
  const fullMoon = controller.computeVisuals();
  assert.ok(Math.abs(fullMoon.moonPhase - 0.5) < 1e-9, "half a synodic month should land on full moon");

  controller.state.dayOfYear = 29.5;
  const resetMoon = controller.computeVisuals();
  assert.ok(resetMoon.moonPhase < 1e-9, "one synodic month should wrap back to new moon");
});

test("sky dome materials use moon occlusion depth, directional horizon uniforms, and star twinkle attributes", async () => {
  const restoreDocument = installCanvasStub();
  try {
    const { atmosphereLayer } = await loadGameModules();
    const dome = atmosphereLayer.createSkyDome();

    assert.equal(dome.starDomeMaterial.depthTest, true);
    assert.equal(dome.moonDiscMaterial.depthTest, true);
    assert.equal(dome.moonDiscMaterial.depthWrite, true);
    assert.deepEqual(
      dome.sunDiscMaterial.map.userData.gradientStops.map((stop) => stop.offset),
      [0, 0.45, 0.65, 1],
      "sun disc should use the tighter warm-core gradient"
    );

    const phaseAttribute = dome.starDome.geometry.getAttribute("phase");
    assert.ok(phaseAttribute, "star dome should expose per-star twinkle phase");
    assert.equal(phaseAttribute.itemSize, 1);
    assert.equal(phaseAttribute.count, 5000);

    const fragmentShader = dome.shellMaterial.fragmentShader;
    assert.match(fragmentShader, /uniform vec3 sunDirection;/);
    assert.match(fragmentShader, /uniform vec3 sunWarmColor;/);
    assert.match(fragmentShader, /uniform vec3 horizonCoolColor;/);

    atmosphereLayer.applySkyVisuals(dome, {
      skyColor: dome.shellMaterial.uniforms.groundColor.value.clone(),
      skyHorizonColor: dome.shellMaterial.uniforms.horizonColor.value.clone(),
      skyZenithColor: dome.shellMaterial.uniforms.zenithColor.value.clone(),
      starOpacity: 0.35,
      sunDirection: { x: 3, y: 1, z: 2 },
      sunWarmColor: dome.shellMaterial.uniforms.horizonColor.value.clone(),
      horizonCoolColor: dome.shellMaterial.uniforms.zenithColor.value.clone(),
      groundColor: dome.shellMaterial.uniforms.groundColor.value.clone(),
      moonPhase: 0.52
    });
    assert.equal(
      dome.moonDiscMaterial.map.userData.phaseIndex,
      4,
      "moon disc should snap to the nearest cached phase texture"
    );

    const shaderStub = {
      uniforms: {},
      vertexShader: "#include <common>\n#include <color_vertex>",
      fragmentShader: "#include <common>\nvec4 diffuseColor = vec4( diffuse, opacity );"
    };
    dome.starDomeMaterial.onBeforeCompile(shaderStub);
    assert.ok(dome.starDomeMaterial.userData.shader, "twinkle shader should be attached after compile");
    assert.ok(shaderStub.uniforms.twinkleTime, "twinkle uniform should be injected into shader");
    assert.equal(dome.starDome.visible, true);
  } finally {
    restoreDocument();
  }
});

test("cloud layer uses three low procedural planes instead of puff sprites", async () => {
  const restoreDocument = installCanvasStub();
  try {
    const { atmosphereLayer } = await loadGameModules();
    const cloudLayer = atmosphereLayer.createCloudLayer();

    assert.equal(cloudLayer.sprites.length, 3);
    assert.equal(cloudLayer.planes.length, 3);
    assert.deepEqual(cloudLayer.planes.map((cloud) => cloud.userData.heightOffset), [8, 12, 16]);

    cloudLayer.planes.forEach((cloud, index) => {
      assert.equal(cloud.children.length, 0);
      assert.ok(
        Number(cloud.userData.driftSpeed) >= 0.4,
        `cloud ${index} drift speed should be positive, got ${cloud.userData.driftSpeed}`
      );
    });
  } finally {
    restoreDocument();
  }
});
