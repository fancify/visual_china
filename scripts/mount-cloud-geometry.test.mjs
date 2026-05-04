import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { Vector3 } from "three";
import ts from "typescript";

async function loadCloudMountModule() {
  const tempRoot = path.resolve(".codex-temp-tests");
  await mkdir(tempRoot, { recursive: true });
  const tempDir = await mkdtemp(path.join(tempRoot, "mount-cloud-"));
  const sourcePath = path.resolve("src/game/mounts/mountCloud.ts");
  const source = await readFile(sourcePath, "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2022,
      target: ts.ScriptTarget.ES2022
    },
    fileName: "mountCloud.ts"
  });

  await writeFile(path.join(tempDir, "mountCloud.js"), output.outputText, "utf8");

  const moduleUrl = new URL(`file://${path.join(tempDir, "mountCloud.js")}`).href;
  const mountCloud = await import(`${moduleUrl}?v=${Date.now()}`);
  await rm(tempDir, { recursive: true, force: true });
  return mountCloud;
}

test("cloud mount geometry merges into a compact auspicious-cloud silhouette", async () => {
  const { buildCloudMountGeometry, CLOUD_MOUNT_COLOR } = await loadCloudMountModule();
  assert.equal(
    typeof buildCloudMountGeometry,
    "function",
    "buildCloudMountGeometry should be exported for geometry regression tests"
  );
  assert.equal(CLOUD_MOUNT_COLOR, 0xe8e2f0);

  const geometry = buildCloudMountGeometry();
  geometry.computeBoundingBox();
  const box = geometry.boundingBox;

  assert.ok(box, "cloud mount geometry should have a bounding box");
  const size = box.getSize(new Vector3());
  const position = geometry.getAttribute("position");

  assert.ok(position.count > 200, `merged cloud should have rich enough geometry, got ${position.count} vertices`);
  assert.ok(size.x >= 1.35 && size.x <= 1.55, `cloud width should stay near 1.4, got ${size.x}`);
  assert.ok(size.y >= 0.65 && size.y <= 0.85, `cloud height should stay near 0.7, got ${size.y}`);
  assert.ok(size.z >= 1.1 && size.z <= 1.35, `cloud depth should stay near 1.2, got ${size.z}`);
});
