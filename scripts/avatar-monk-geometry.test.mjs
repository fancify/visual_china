import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { Box3, Group } from "three";
import ts from "typescript";

async function loadAvatarModule() {
  const tempRoot = path.resolve(".codex-temp-tests");
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(path.join(tempRoot, "avatar-monk-"));
  const sourceFile = "src/game/avatars.ts";
  const sourcePath = path.resolve(sourceFile);
  const source = await readFile(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    },
    fileName: path.basename(sourcePath)
  });
  const targetPath = path.join(tempDir, "avatars.js");
  await writeFile(targetPath, output.outputText, "utf8");

  const moduleUrl = new URL(`file://${targetPath}`).href;
  const avatars = await import(`${moduleUrl}?v=${Date.now()}`);
  await rm(tempDir, { recursive: true, force: true });
  return avatars;
}

test("monk avatar builds a full seated geometry set", async () => {
  const { createAvatar } = await loadAvatarModule();

  const handle = createAvatar("monk");
  assert.ok(handle.avatar instanceof Group, "monk avatar should return a Group handle");

  handle.avatar.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(handle.avatar);
  assert.ok(bounds.max.y > 1.4, `monk avatar should reach a readable seated height, got ${bounds.max.y}`);

  let meshCount = 0;
  handle.avatar.traverse((node) => {
    if (node.isMesh) {
      meshCount += 1;
    }
  });
  assert.ok(meshCount >= 14, `monk avatar should include torso, limbs, robe and beads, got ${meshCount} meshes`);
});
