import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { Group } from "three";
import ts from "typescript";

async function writeTranspiledModule(tempDir, sourceRelativePath) {
  const sourcePath = path.resolve(sourceRelativePath);
  const source = await readFile(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    },
    fileName: path.basename(sourcePath)
  });
  const targetRelativePath = sourceRelativePath
    .replace(/^src\/game\//, "")
    .replace(/\.ts$/, ".js");
  const targetPath = path.join(tempDir, targetRelativePath);
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, output.outputText, "utf8");
}

async function loadAvatarRigModules() {
  const tempRoot = path.resolve(".codex-temp-tests");
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(path.join(tempRoot, "avatar-arm-rig-"));
  const sourceFiles = [
    "src/game/avatars.ts",
    "src/game/mountRuntime.ts",
    "src/game/mounts.ts",
    "src/game/mounts/mountCloud.ts",
    "src/game/playerCustomization.ts",
    "src/game/sceneryShaderEnhancer.ts",
    "src/game/playerAvatarMesh.ts"
  ];

  for (const sourceFile of sourceFiles) {
    await writeTranspiledModule(tempDir, sourceFile);
  }

  const avatarsUrl = new URL(`file://${path.join(tempDir, "avatars.js")}`).href;
  const playerAvatarMeshUrl = new URL(
    `file://${path.join(tempDir, "playerAvatarMesh.js")}`
  ).href;
  const avatars = await import(`${avatarsUrl}?v=${Date.now()}`);
  const playerAvatarMesh = await import(`${playerAvatarMeshUrl}?v=${Date.now()}`);

  await rm(tempDir, { recursive: true, force: true });
  return { avatars, playerAvatarMesh };
}

test("walking arm rig returns two named arms when avatar exposes both arm anchors", async () => {
  const { avatars, playerAvatarMesh } = await loadAvatarRigModules();
  const { createAvatar } = avatars;
  const { buildWalkingAvatarArmRig } = playerAvatarMesh;

  const handle = createAvatar("default");
  const armsByName = buildWalkingAvatarArmRig(handle.avatar);

  assert.equal(armsByName.size, 2);
  assert.ok(armsByName.has("avatar-walk-left-arm"));
  assert.ok(armsByName.has("avatar-walk-right-arm"));
});

test("walking arm rig returns an empty map when the avatar does not expose both named arms", async () => {
  const { playerAvatarMesh } = await loadAvatarRigModules();
  const { buildWalkingAvatarArmRig } = playerAvatarMesh;

  const armsByName = buildWalkingAvatarArmRig(new Group());

  assert.equal(armsByName.size, 0);
});
