import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { Vector3 } from "three";
import ts from "typescript";

async function loadMountModule() {
  const tempRoot = path.resolve(".codex-temp-tests");
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(path.join(tempRoot, "mount-fox-"));
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

function getConeEndpoint(mesh, direction) {
  const { height } = mesh.geometry.parameters;
  const local = new Vector3(0, direction * height * 0.5, 0);
  return mesh.localToWorld(local);
}

function getWorldSize(mesh) {
  mesh.geometry.computeBoundingBox();
  const worldBox = mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld);
  return worldBox.getSize(new Vector3());
}

test("fox body stays slimmer than the larger rideable mounts and tail tip joins the tail base", async () => {
  const { buildFox } = await loadMountModule();
  assert.equal(typeof buildFox, "function", "buildFox should be exported for geometry regression tests");

  const { mount } = buildFox();
  mount.updateMatrixWorld(true);

  const body = mount.getObjectByName("mount-fox-body");
  const tailBase = mount.getObjectByName("mount-fox-tail-base");
  const tailTip = mount.getObjectByName("mount-fox-tail-tip");

  assert.ok(body, "fox body mesh should be named");
  assert.ok(tailBase, "fox tail base mesh should be named");
  assert.ok(tailTip, "fox tail tip mesh should be named");

  const bodySize = getWorldSize(body);
  assert.ok(bodySize.x < 2.0, `fox body should stay shorter than 2.0, got ${bodySize.x}`);
  assert.ok(bodySize.y < 0.7, `fox body should stay lower than 0.7, got ${bodySize.y}`);
  assert.ok(bodySize.z < 0.7, `fox body should stay narrower than 0.7, got ${bodySize.z}`);

  const tailBaseTip = getConeEndpoint(tailBase, 1);
  const tailTipBase = getConeEndpoint(tailTip, -1);
  assert.ok(
    tailBaseTip.distanceTo(tailTipBase) < 0.05,
    `fox tail segments should connect, got distance ${tailBaseTip.distanceTo(tailTipBase)}`
  );
});
