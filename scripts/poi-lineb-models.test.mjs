import assert from "node:assert/strict";
import test from "node:test";

import { POI_REGISTRY } from "../src/data/poiRegistry.generated.ts";
import { resolvePoiModel } from "../src/game/poi/models/registry.ts";

test("Line B POI model resolver returns the existing Tang archetype builders", () => {
  const cases = [
    [{ id: "demo-city", archetype: "city", size: "large" }, "city_large"],
    [{ id: "demo-cave", archetype: "cave" }, "cave_default"],
    [{ id: "demo-pass", archetype: "pass", variant: "major" }, "pass_major"],
    [{ id: "demo-temple", archetype: "temple", variant: "taoist" }, "temple_taoist"],
    [{ id: "demo-node", archetype: "node", variant: "bridge" }, "node_bridge"]
  ];

  for (const [entry, expectedName] of cases) {
    const model = resolvePoiModel(entry)();
    assert.equal(model.name, expectedName);
    assert.ok(model.children.length > 0, `${expectedName} should contain meshes/parts`);
  }
});

test("generated Line B POI registry carries model selection fields", () => {
  const changan = POI_REGISTRY.find((poi) => poi.name === "长安");
  assert.ok(changan, "expected 长安 in generated POI registry");
  assert.equal(changan.archetype, "city");
  assert.equal(changan.size, "large");

  const cave = POI_REGISTRY.find((poi) => poi.name.includes("石窟"));
  assert.ok(cave, "expected at least one grotto/cave POI");
  assert.equal(cave.archetype, "cave");
});

test("temple pagodas keep the newer Line B spacing from the main hall", () => {
  const smallTemple = resolvePoiModel({ id: "demo-temple", archetype: "temple", variant: "small_temple" })();
  assert.equal(smallTemple.getObjectByName("temple_small_frontPagoda")?.position.z, 1.35);

  const grandTemple = resolvePoiModel({ id: "demo-grand-temple", archetype: "temple", variant: "grand" })();
  assert.equal(grandTemple.getObjectByName("temple_grand_frontPagoda")?.position.z, 1.85);

  const taoistTemple = resolvePoiModel({ id: "demo-taoist-temple", archetype: "temple", variant: "taoist" })();
  assert.equal(taoistTemple.getObjectByName("temple_taoist_frontPagoda")?.position.z, 1.35);
});
