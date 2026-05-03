import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { Vector3 } from "three";
import ts from "typescript";

async function loadMountModule() {
  const tempRoot = path.resolve(".codex-temp-tests");
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(path.join(tempRoot, "mount-pig-"));
  const sourcePath = path.resolve("src/game/mounts.ts");
  const source = await readFile(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    },
    fileName: "mounts.ts"
  });

  await writeFile(path.join(tempDir, "mounts.js"), output.outputText, "utf8");

  const moduleUrl = new URL(`file://${path.join(tempDir, "mounts.js")}`).href;
  const mounts = await import(`${moduleUrl}?v=${Date.now()}`);
  await rm(tempDir, { recursive: true, force: true });
  return mounts;
}

function getWorldSize(mesh) {
  mesh.geometry.computeBoundingBox();
  const worldBox = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
  return worldBox.getSize(new Vector3());
}

test("pig stays compact and keeps a low saddle height", async () => {
  const { createMount } = await loadMountModule();
  assert.equal(typeof createMount, "function", "createMount should be available for mount regression tests");

  const { mount, saddleHeight } = createMount("pig");
  mount.updateMatrixWorld(true);

  const body = mount.getObjectByName("mount-pig-body");
  assert.ok(body, "pig body mesh should be named");

  const bodySize = getWorldSize(body);
  assert.ok(bodySize.x < 1.7, `pig body should stay shorter than 1.7, got ${bodySize.x}`);
  assert.ok(bodySize.y < 0.6, `pig body should stay lower than 0.6, got ${bodySize.y}`);
  assert.ok(bodySize.z < 0.7, `pig body should stay narrower than 0.7, got ${bodySize.z}`);
  assert.ok(saddleHeight >= 0.85, `pig saddle height should stay above 0.85, got ${saddleHeight}`);
  assert.ok(saddleHeight <= 1.0, `pig saddle height should stay below 1.0, got ${saddleHeight}`);
});
