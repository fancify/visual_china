import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { Vector3 } from "three";
import ts from "typescript";

async function loadMountModule() {
  const tempRoot = path.resolve(".codex-temp-tests");
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(path.join(tempRoot, "mount-chicken-"));
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

test("chicken keeps a toy-sized body, two-leg rig, and a low saddle height", async () => {
  const { createMount } = await loadMountModule();
  assert.equal(typeof createMount, "function", "createMount should be available for mount regression tests");

  const { mount, legsByName, saddleHeight } = createMount("chicken");
  mount.updateMatrixWorld(true);

  const body = mount.getObjectByName("mount-chicken-body");
  assert.ok(body, "chicken body mesh should be named");

  const bodySize = getWorldSize(body);
  assert.ok(bodySize.x < 0.7, `chicken body should stay shorter than 0.7, got ${bodySize.x}`);
  assert.ok(bodySize.y < 1.0, `chicken body should stay lower than 1.0, got ${bodySize.y}`);
  assert.ok(bodySize.z < 0.7, `chicken body should stay narrower than 0.7, got ${bodySize.z}`);
  assert.equal(legsByName.size, 2, `chicken should expose 2 animated legs, got ${legsByName.size}`);
  assert.ok(saddleHeight >= 0.78, `chicken saddle height should stay above 0.78, got ${saddleHeight}`);
  assert.ok(saddleHeight <= 0.92, `chicken saddle height should stay below 0.92, got ${saddleHeight}`);
});
