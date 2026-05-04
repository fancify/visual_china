import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import ts from "typescript";

import {
  avatarHeadingForMovement,
  woodHorseLegPose,
  woodHorseAvatarParts
} from "../src/game/playerAvatar.js";

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

async function loadAvatarModule() {
  const tempRoot = path.resolve(".codex-temp-tests");
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(path.join(tempRoot, "player-avatar-"));
  await writeTranspiledModule(tempDir, "src/game/avatars.ts");
  const avatarsUrl = new URL(`file://${path.join(tempDir, "avatars.js")}`).href;
  const avatars = await import(`${avatarsUrl}?v=${Date.now()}`);
  await rm(tempDir, { recursive: true, force: true });
  return avatars;
}

test("wood horse avatar has readable toy horse and rider parts", () => {
  const partNames = new Set(woodHorseAvatarParts.map((part) => part.name));

  assert.ok(partNames.has("wooden-horse-body"));
  assert.ok(partNames.has("wooden-horse-head"));
  assert.ok(partNames.has("front-left-leg"));
  assert.ok(partNames.has("front-right-leg"));
  assert.ok(partNames.has("back-left-leg"));
  assert.ok(partNames.has("back-right-leg"));
  assert.ok(partNames.has("traveler-cloak"));
  // route-banner（红旗）按用户要求去掉，换成更可爱的斗笠 + 眼睛
  assert.ok(partNames.has("traveler-douli"));
  assert.ok(partNames.has("traveler-eye-left"));
  assert.ok(partNames.has("traveler-eye-right"));
});

test("wood horse head points toward the movement vector", () => {
  assert.equal(avatarHeadingForMovement({ x: 1, z: 0 }), 0);
  assert.ok(Math.abs(avatarHeadingForMovement({ x: 0, z: 1 }) + Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(avatarHeadingForMovement({ x: 0, z: -1 }) - Math.PI / 2) < 1e-9);
});

test("wood horse legs swing in playful diagonal pairs while moving", () => {
  const standing = woodHorseLegPose({ timeSeconds: 0, movementIntensity: 0 });
  const walking = woodHorseLegPose({ timeSeconds: 0.12, movementIntensity: 1 });

  assert.equal(standing["front-left-leg"], 0.1);
  assert.equal(standing["front-right-leg"], -0.1);
  assert.notEqual(walking["front-left-leg"], standing["front-left-leg"]);
  assert.notEqual(walking["front-right-leg"], standing["front-right-leg"]);
  assert.equal(
    Math.sign(walking["front-left-leg"] - standing["front-left-leg"]),
    Math.sign(walking["back-right-leg"] - standing["back-right-leg"])
  );
  assert.equal(
    Math.sign(walking["front-right-leg"] - standing["front-right-leg"]),
    Math.sign(walking["back-left-leg"] - standing["back-left-leg"])
  );
  assert.notEqual(
    Math.sign(walking["front-left-leg"] - standing["front-left-leg"]),
    Math.sign(walking["front-right-leg"] - standing["front-right-leg"])
  );
});

test("every avatar builder exposes stable left and right arm anchors", async () => {
  const { AVATAR_DEFINITIONS, createAvatar } = await loadAvatarModule();

  AVATAR_DEFINITIONS.forEach((definition) => {
    const handle = createAvatar(definition.id);
    assert.ok(
      handle.avatar.getObjectByName("avatar-arm-left"),
      `${definition.id} should expose avatar-arm-left`
    );
    assert.ok(
      handle.avatar.getObjectByName("avatar-arm-right"),
      `${definition.id} should expose avatar-arm-right`
    );
  });
});
