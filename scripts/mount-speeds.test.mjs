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
  assert.equal(mountSpeedMultiplier("cloud"), 4);

  for (let index = 1; index < speeds.length; index += 1) {
    assert.ok(
      speeds[index - 1] < speeds[index],
      `mount speeds should strictly increase in the intended order, got ${orderedMounts[index - 1]}=${speeds[index - 1]} and ${orderedMounts[index]}=${speeds[index]}`
    );
  }

  assert.equal(Math.min(...speeds), mountSpeedMultiplier("none"));
  assert.equal(Math.max(...speeds), mountSpeedMultiplier("cloud"));
});
