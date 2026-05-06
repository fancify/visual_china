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
  // 新头身比把头略收小，但整体高度仍需保持可读。
  assert.ok(bounds.max.y > 1.3, `monk avatar should reach a readable seated height, got ${bounds.max.y}`);

  const robe = handle.avatar.getObjectByName("avatar-robe");
  assert.ok(robe, "monk avatar should expose avatar-robe");
  assert.equal(robe.geometry?.type, "CylinderGeometry");
  // 用户反馈"身躯太粗"——僧袍 r 0.36→0.22 跟 torso 一起变窄。
  assert.equal(robe.geometry?.parameters?.radiusTop, 0.22);
  assert.equal(robe.geometry?.parameters?.radiusBottom, 0.22);
  // 袈裟披全身：h 0.55 → 0.84, position 0.3 → 0.42。
  assert.equal(robe.geometry?.parameters?.height, 0.84);
  assert.equal(robe.position.y, 0.42);

  let meshCount = 0;
  handle.avatar.traverse((node) => {
    if (node.isMesh) {
      meshCount += 1;
    }
  });
  // 新比例增加了脖子与更醒目的眼睛，僧袍仍保持极简但 mesh 总数更高。
  assert.ok(meshCount >= 10, `monk avatar should include torso, limbs, robe and beads, got ${meshCount} meshes`);
});
