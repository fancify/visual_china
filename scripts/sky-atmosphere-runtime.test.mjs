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
    createRadialGradient: createGradient,
    createLinearGradient: createGradient,
    fillRect() {},
    clearRect() {},
    beginPath() {},
    arc() {},
    fill() {},
    stroke() {},
    ellipse() {}
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

test("sky dome materials use moon occlusion depth, directional horizon uniforms, and star twinkle attributes", async () => {
  const restoreDocument = installCanvasStub();
  try {
    const { atmosphereLayer } = await loadGameModules();
    const dome = atmosphereLayer.createSkyDome();

    assert.equal(dome.starDomeMaterial.depthTest, true);
    assert.equal(dome.moonDiscMaterial.depthTest, true);
    assert.equal(dome.moonDiscMaterial.depthWrite, true);

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
      groundColor: dome.shellMaterial.uniforms.groundColor.value.clone()
    });

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
