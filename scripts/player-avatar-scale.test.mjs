import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
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

async function loadPlayerAvatarModules() {
  const tempRoot = path.resolve(".codex-temp-tests");
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(path.join(tempRoot, "player-avatar-scale-"));
  const sourceFiles = [
    "src/game/avatars.ts",
    "src/game/mountRuntime.ts",
    "src/game/mounts.ts",
    "src/game/mounts/mountCloud.ts",
    "src/game/playerCustomization.ts",
    "src/game/playerAvatarMesh.ts"
  ];

  for (const sourceFile of sourceFiles) {
    await writeTranspiledModule(tempDir, sourceFile);
  }

  const playerAvatarMeshUrl = new URL(
    `file://${path.join(tempDir, "playerAvatarMesh.js")}`
  ).href;
  const playerCustomizationUrl = new URL(
    `file://${path.join(tempDir, "playerCustomization.js")}`
  ).href;
  const mountsUrl = new URL(`file://${path.join(tempDir, "mounts.js")}`).href;

  const playerAvatarMesh = await import(`${playerAvatarMeshUrl}?v=${Date.now()}`);
  const playerCustomization = await import(
    `${playerCustomizationUrl}?v=${Date.now()}`
  );
  const mounts = await import(`${mountsUrl}?v=${Date.now()}`);

  await rm(tempDir, { recursive: true, force: true });
  return { playerAvatarMesh, playerCustomization, mounts };
}

test("player root scales rider and mount down to two-thirds and mount cycling includes on-foot mode first", async () => {
  const { playerAvatarMesh, playerCustomization, mounts } =
    await loadPlayerAvatarModules();
  const { createPlayerAvatar, rebuildPlayerAvatar } = playerAvatarMesh;
  const { cycleAvatar, cycleMount, listAvatars } = playerCustomization;
  const { MOUNT_DEFINITIONS } = mounts;

  const handle = createPlayerAvatar();
  assert.equal(handle.player.scale.x, 2 / 3);
  assert.equal(handle.player.scale.y, 2 / 3);
  assert.equal(handle.player.scale.z, 2 / 3);
  assert.ok(handle.player.children.length >= 2, "player should still assemble mount and avatar children");

  assert.equal(MOUNT_DEFINITIONS[0]?.id, "none");
  assert.equal(MOUNT_DEFINITIONS[1]?.id, "horse");
  assert.equal(MOUNT_DEFINITIONS[2]?.id, "ox");
  assert.equal(cycleMount("horse", -1), "none");
  assert.equal(cycleMount("horse", 1), "ox");
  assert.equal(listAvatars().length, 6);
  assert.equal(listAvatars()[5]?.id, "monk");
  assert.equal(cycleAvatar("nongfu", 1), "monk");
  assert.equal(cycleAvatar("monk", 1), "default");

  const rebuilt = rebuildPlayerAvatar(handle.player, "none", "default");
  assert.equal(rebuilt.mountLegsByName.size, 0, "on-foot mode should not expose mount leg meshes");
  assert.ok(
    handle.player.getObjectByName("avatar-walk-left-leg"),
    "on-foot mode should add a left walking leg to the avatar rig"
  );
  assert.ok(
    handle.player.getObjectByName("avatar-walk-right-leg"),
    "on-foot mode should add a right walking leg to the avatar rig"
  );
});
