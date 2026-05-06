import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { Box3 } from "three";
import ts from "typescript";

async function loadAvatarModule() {
  const tempRoot = path.resolve(".codex-temp-tests");
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(path.join(tempRoot, "avatar-shoulder-"));
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

function boundsFor(node) {
  return new Box3().setFromObject(node);
}

test("every seated avatar bridges shoulders to arms and overlaps thighs into torso", async () => {
  const { AVATAR_DEFINITIONS, createAvatar } = await loadAvatarModule();

  AVATAR_DEFINITIONS.forEach((definition) => {
    const handle = createAvatar(definition.id);
    handle.avatar.updateMatrixWorld(true);

    const torso = handle.avatar.getObjectByName("avatar-torso");
    const head = handle.avatar.getObjectByName("avatar-head");
    const neck = handle.avatar.getObjectByName("avatar-neck");
    const leftShoulder = handle.avatar.getObjectByName("avatar-shoulder-left");
    const rightShoulder = handle.avatar.getObjectByName("avatar-shoulder-right");
    const leftArm = handle.avatar.getObjectByName("avatar-arm-left");
    const rightArm = handle.avatar.getObjectByName("avatar-arm-right");
    const leftThigh = handle.avatar.getObjectByName("avatar-thigh-left");
    const rightThigh = handle.avatar.getObjectByName("avatar-thigh-right");

    assert.ok(torso, `${definition.id} should expose avatar-torso`);
    assert.ok(head, `${definition.id} should expose avatar-head`);
    assert.ok(neck, `${definition.id} should expose avatar-neck`);
    assert.ok(leftShoulder, `${definition.id} should expose avatar-shoulder-left`);
    assert.ok(rightShoulder, `${definition.id} should expose avatar-shoulder-right`);
    assert.ok(leftArm, `${definition.id} should expose avatar-arm-left`);
    assert.ok(rightArm, `${definition.id} should expose avatar-arm-right`);
    assert.ok(leftThigh, `${definition.id} should expose avatar-thigh-left`);
    assert.ok(rightThigh, `${definition.id} should expose avatar-thigh-right`);

    const torsoBounds = boundsFor(torso);
    const headBounds = boundsFor(head);
    const neckBounds = boundsFor(neck);
    const leftShoulderBounds = boundsFor(leftShoulder);
    const rightShoulderBounds = boundsFor(rightShoulder);
    const leftArmBounds = boundsFor(leftArm);
    const rightArmBounds = boundsFor(rightArm);
    const leftThighBounds = boundsFor(leftThigh);
    const rightThighBounds = boundsFor(rightThigh);

    assert.ok(
      headBounds.min.y >= torsoBounds.max.y - 0.02,
      `${definition.id} head should sit almost fully above the torso`
    );
    assert.ok(
      neckBounds.intersectsBox(torsoBounds),
      `${definition.id} neck should bridge into torso`
    );
    assert.ok(
      neckBounds.intersectsBox(headBounds),
      `${definition.id} neck should bridge into head`
    );
    assert.ok(
      torsoBounds.intersectsBox(leftShoulderBounds),
      `${definition.id} left shoulder should intersect torso`
    );
    assert.ok(
      torsoBounds.intersectsBox(rightShoulderBounds),
      `${definition.id} right shoulder should intersect torso`
    );
    assert.ok(
      leftShoulderBounds.intersectsBox(leftArmBounds),
      `${definition.id} left shoulder should intersect arm`
    );
    assert.ok(
      rightShoulderBounds.intersectsBox(rightArmBounds),
      `${definition.id} right shoulder should intersect arm`
    );
    assert.ok(
      torsoBounds.intersectsBox(leftThighBounds),
      `${definition.id} left thigh should overlap torso`
    );
    assert.ok(
      torsoBounds.intersectsBox(rightThighBounds),
      `${definition.id} right thigh should overlap torso`
    );
  });
});
