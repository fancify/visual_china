import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { Group } from "three";
import ts from "typescript";

async function loadMountModule() {
  const tempRoot = path.resolve(".codex-temp-tests");
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(path.join(tempRoot, "mount-none-"));
  const sourceFiles = [
    "src/game/mounts.ts",
    "src/game/mounts/mountCloud.ts"
  ];

  for (const sourceFile of sourceFiles) {
    const sourcePath = path.resolve(sourceFile);
    const source = await readFile(sourcePath, "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.ES2022,
        target: ts.ScriptTarget.ES2022
      },
      fileName: path.basename(sourcePath)
    });
    const targetRelativePath = sourceFile
      .replace(/^src\/game\//, "")
      .replace(/\.ts$/, ".js");
    const targetPath = path.join(tempDir, targetRelativePath);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await writeFile(targetPath, output.outputText, "utf8");
  }

  const moduleUrl = new URL(`file://${path.join(tempDir, "mounts.js")}`).href;
  const mounts = await import(`${moduleUrl}?v=${Date.now()}`);
  await rm(tempDir, { recursive: true, force: true });
  return mounts;
}

test("none mount builds an empty handle that keeps the rider on foot", async () => {
  const { createMount, MOUNT_DEFINITIONS } = await loadMountModule();
  assert.equal(typeof createMount, "function", "createMount should be available for mount regression tests");
  assert.equal(MOUNT_DEFINITIONS[0]?.id, "none");

  const handle = createMount("none");

  assert.ok(handle.mount instanceof Group, "none mount should still provide a Group handle");
  assert.equal(handle.mount.children.length, 0, "none mount should not render any geometry");
  assert.equal(handle.legsByName.size, 0, "none mount should not expose animated mount legs");
  assert.equal(handle.saddleHeight, 0);
  assert.equal(handle.saddleX, 0);
});
