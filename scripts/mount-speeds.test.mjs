import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

async function loadMountRuntimeModule() {
  const tempRoot = path.resolve(".codex-temp-tests");
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(path.join(tempRoot, "mount-speed-"));
  const sourcePath = path.resolve("src/game/mountRuntime.ts");
  const source = await readFile(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    },
    fileName: "mountRuntime.ts"
  });

  await writeFile(path.join(tempDir, "mountRuntime.js"), output.outputText, "utf8");

  const moduleUrl = new URL(`file://${path.join(tempDir, "mountRuntime.js")}`).href;
  const mountRuntime = await import(`${moduleUrl}?v=${Date.now()}`);
  await rm(tempDir, { recursive: true, force: true });
  return mountRuntime;
}

function extractMainNodes(source, names) {
  const sourceFile = ts.createSourceFile(
    "main.ts",
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.TS
  );
  const remaining = new Set(names);
  const snippets = [];

  sourceFile.forEachChild((node) => {
    if (ts.isVariableStatement(node)) {
      const matchedDeclarations = node.declarationList.declarations.filter((declaration) => {
        return ts.isIdentifier(declaration.name) && remaining.has(declaration.name.text);
      });

      if (matchedDeclarations.length > 0) {
        const statements = matchedDeclarations.map((declaration) => {
          return `const ${declaration.name.getText(sourceFile)} = ${declaration.initializer?.getText(sourceFile)};`;
        });
        statements.forEach((statement) => snippets.push(statement));
        matchedDeclarations.forEach((declaration) => remaining.delete(declaration.name.text));
      }
      return;
    }

    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      remaining.has(node.name.text)
    ) {
      snippets.push(node.getText(sourceFile));
      remaining.delete(node.name.text);
    }
  });

  if (remaining.size > 0) {
    throw new Error(`Failed to extract main.ts nodes: ${Array.from(remaining).join(", ")}`);
  }

  return snippets.join("\n\n");
}

async function loadMainCloudFlightHelpers() {
  const tempRoot = path.resolve(".codex-temp-tests");
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(path.join(tempRoot, "cloud-flight-"));
  const sourcePath = path.resolve("src/main.ts");
  const source = await readFile(sourcePath, "utf8");
  const snippet = extractMainNodes(source, [
    "CLOUD_FLIGHT_ASCEND_STEP",
    "CLOUD_FLIGHT_MAX_ALTITUDE",
    "CLOUD_FLIGHT_MIN_ABSOLUTE",
    "CLOUD_FLIGHT_DEFAULT_GROUND_OFFSET",
    "isFlyingMount",
    "resolvePlayerTargetY",
    "resetCloudFlightAltitudeForGround",
    "nextCloudFlightAltitude"
  ]);
  const output = ts.transpileModule(
    [
      'import { MathUtils } from "three";',
      snippet
    ].join("\n\n"),
    {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022
      },
      fileName: "cloudFlight.ts"
    }
  );

  await writeFile(path.join(tempDir, "cloudFlight.js"), output.outputText, "utf8");

  const moduleUrl = new URL(`file://${path.join(tempDir, "cloudFlight.js")}`).href;
  const cloudFlight = await import(`${moduleUrl}?v=${Date.now()}`);
  await rm(tempDir, { recursive: true, force: true });
  return cloudFlight;
}

test("mount speed multipliers reflect each mount's intended travel feel", async () => {
  const { mountSpeedMultiplier } = await loadMountRuntimeModule();
  assert.equal(
    typeof mountSpeedMultiplier,
    "function",
    "mountSpeedMultiplier should be exported for runtime speed tests"
  );

  const orderedMounts = [
    "none",
    "ox",
    "pig",
    "donkey",
    "boar",
    "sheep",
    "chicken",
    "fox",
    "horse",
    "cloud"
  ];
  const speeds = orderedMounts.map((mountId) => mountSpeedMultiplier(mountId));

  assert.equal(speeds.length, 10, "all 10 mounts should expose a speed multiplier");
  assert.equal(mountSpeedMultiplier("none"), 0.5);
  assert.equal(mountSpeedMultiplier("ox"), 0.6);
  assert.equal(mountSpeedMultiplier("pig"), 0.7);
  assert.equal(mountSpeedMultiplier("donkey"), 0.85);
  assert.equal(mountSpeedMultiplier("boar"), 0.9);
  assert.equal(mountSpeedMultiplier("sheep"), 1);
  assert.equal(mountSpeedMultiplier("chicken"), 1.1);
  assert.equal(mountSpeedMultiplier("fox"), 1.2);
  assert.equal(mountSpeedMultiplier("horse"), 1.6);
  assert.equal(mountSpeedMultiplier("cloud"), 2.7);

  for (let index = 1; index < speeds.length; index += 1) {
    assert.ok(
      speeds[index - 1] < speeds[index],
      `mount speeds should strictly increase in the intended order, got ${orderedMounts[index - 1]}=${speeds[index - 1]} and ${orderedMounts[index]}=${speeds[index]}`
    );
  }

  assert.equal(Math.min(...speeds), mountSpeedMultiplier("none"));
  assert.equal(Math.max(...speeds), mountSpeedMultiplier("cloud"));
});

test("mount inertia helpers expose heavier acceleration for cloud than walking", async () => {
  const {
    advanceMountVelocityScale,
    mountInertiaFactor
  } = await loadMountRuntimeModule();

  assert.equal(
    typeof mountInertiaFactor,
    "function",
    "mountInertiaFactor should be exported for runtime inertia tuning tests"
  );
  assert.equal(
    typeof advanceMountVelocityScale,
    "function",
    "advanceMountVelocityScale should be exported for runtime inertia lerp tests"
  );

  assert.equal(mountInertiaFactor("cloud"), 0.04);
  assert.equal(mountInertiaFactor("horse"), 0.12);
  assert.equal(mountInertiaFactor("none"), 0.3);
  assert.equal(mountInertiaFactor("fox"), 0.18);

  const cloudStart = advanceMountVelocityScale({
    currentScale: 0,
    targetScale: 1,
    mountId: "cloud"
  });
  const walkStart = advanceMountVelocityScale({
    currentScale: 0,
    targetScale: 1,
    mountId: "none"
  });
  const cloudDecay = advanceMountVelocityScale({
    currentScale: 1,
    targetScale: 0,
    mountId: "cloud"
  });

  assert.ok(cloudStart > 0 && cloudStart < 0.05);
  assert.ok(walkStart > 0.25 && walkStart < 0.31);
  assert.ok(
    cloudStart < walkStart,
    `cloud should accelerate more slowly than walking, got cloud=${cloudStart}, walk=${walkStart}`
  );
  assert.ok(
    cloudDecay > 0.9,
    `cloud should retain most of its velocity one frame after release, got ${cloudDecay}`
  );
});

test("cloud flight helpers only react on the cloud mount and clamp altitude controls", async () => {
  const {
    nextCloudFlightAltitude,
    resetCloudFlightAltitudeForGround,
    resolvePlayerTargetY
  } = await loadMainCloudFlightHelpers();

  assert.equal(typeof nextCloudFlightAltitude, "function");
  assert.equal(typeof resetCloudFlightAltitudeForGround, "function");
  assert.equal(typeof resolvePlayerTargetY, "function");

  // Phase 3 全国画幅：DEFAULT_GROUND_OFFSET 8 → 24 (×3)。
  assert.equal(resetCloudFlightAltitudeForGround(7), 31);
  assert.equal(
    nextCloudFlightAltitude({
      currentMountId: "horse",
      keys: new Set([" "]),
      ground: 12,
      cloudFlightAltitude: 21
    }),
    21,
    "space should not affect altitude when the player is not on the cloud mount"
  );
  assert.equal(
    resolvePlayerTargetY({
      currentMountId: "horse",
      ground: 12,
      cloudFlightAltitude: 30
    }),
    12.35
  );

  // Phase 3 全国画幅：MAX 150 / MIN_ABSOLUTE 25（绝对高度，跟地面无关）。
  assert.equal(
    nextCloudFlightAltitude({
      currentMountId: "cloud",
      keys: new Set([" "]),
      ground: 10,
      cloudFlightAltitude: 149.5
    }),
    150,
    "space ascent should clamp at the max flight altitude"
  );
  assert.equal(
    nextCloudFlightAltitude({
      currentMountId: "cloud",
      keys: new Set(["x"]),
      ground: 10,
      cloudFlightAltitude: 26
    }),
    25,
    "x descent should clamp to absolute MIN 25 regardless of ground"
  );
  assert.equal(
    resolvePlayerTargetY({
      currentMountId: "cloud",
      ground: 12,
      cloudFlightAltitude: 27.5
    }),
    27.5
  );

  // 御剑跟筋斗云共享 isFlyingMount → 应该接受相同的飞行控制。
  assert.equal(
    nextCloudFlightAltitude({
      currentMountId: "sword",
      keys: new Set([" "]),
      ground: 10,
      cloudFlightAltitude: 26
    }),
    26 + 1.2,
    "sword should also ascend with space"
  );
  assert.equal(
    resolvePlayerTargetY({
      currentMountId: "sword",
      ground: 12,
      cloudFlightAltitude: 30
    }),
    30,
    "sword target Y should track cloudFlightAltitude like cloud"
  );
});
