import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { Color, Vector3 } from "three";
import ts from "typescript";

async function loadMountModule() {
  const tempRoot = path.resolve(".codex-temp-tests");
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(path.join(tempRoot, "mount-boar-"));
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

function getMaterialHex(mesh) {
  const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
  return material?.color instanceof Color ? material.color.getHex() : null;
}

test("boar stays compact, exposes bristles and tusks, and keeps a mid saddle height", async () => {
  const { createMount } = await loadMountModule();
  assert.equal(typeof createMount, "function", "createMount should be available for mount regression tests");

  const { mount, saddleHeight } = createMount("boar");
  mount.updateMatrixWorld(true);

  const body = mount.getObjectByName("mount-boar-body");
  assert.ok(body, "boar body mesh should be named");

  const bodySize = getWorldSize(body);
  assert.ok(bodySize.x <= 1.7, `boar body should stay no longer than 1.7, got ${bodySize.x}`);
  assert.ok(bodySize.y <= 0.7, `boar body should stay no taller than 0.7, got ${bodySize.y}`);
  assert.ok(bodySize.z <= 0.7, `boar body should stay no wider than 0.7, got ${bodySize.z}`);

  const bristles = mount.children.filter((child) => {
    if (!(child instanceof Object) || typeof child.position?.y !== "number") {
      return false;
    }
    const isCone = child.geometry?.type === "ConeGeometry";
    const isNamedBristle = typeof child.name === "string" && child.name.startsWith("mount-boar-bristle-");
    return isCone && (isNamedBristle || child.position.y > 0.85);
  });
  assert.ok(bristles.length >= 5, `boar should have at least 5 back bristles, got ${bristles.length}`);

  const tusks = mount.children.filter(
    (child) => child.geometry?.type === "ConeGeometry" && getMaterialHex(child) === 0xe8e4d5
  );
  assert.equal(tusks.length, 2, `boar should have 2 tusks, got ${tusks.length}`);

  assert.ok(saddleHeight >= 0.95, `boar saddle height should stay above 0.95, got ${saddleHeight}`);
  assert.ok(saddleHeight <= 1.1, `boar saddle height should stay below 1.1, got ${saddleHeight}`);
});
