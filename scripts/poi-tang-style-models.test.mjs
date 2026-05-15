import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const tangParts = await readFile("src/game/poi/models/tangParts.ts", "utf8");
const pass = await readFile("src/game/poi/models/archetypes/pass.ts", "utf8");
const cave = await readFile("src/game/poi/models/archetypes/cave.ts", "utf8");
const mausoleum = await readFile("src/game/poi/models/archetypes/mausoleum.ts", "utf8");
const city = await readFile("src/game/poi/models/archetypes/city.ts", "utf8");
const temple = await readFile("src/game/poi/models/archetypes/temple.ts", "utf8");
const node = await readFile("src/game/poi/models/archetypes/node.ts", "utf8");
const poiDemo = await readFile("src/poiArchetypeDemo.ts", "utf8");

test("Tang hall roofs use joined eave plates instead of cone spike eaves", () => {
  assert.match(tangParts, /buildLiftedCornerEaves/);
  assert.match(tangParts, /hipRoof_shadowSkirt/);
  assert.doesNotMatch(
    tangParts,
    /new THREE\.ConeGeometry\(eaveR,\s*eaveLen,\s*4\)/,
    "corner eaves should not be cone spikes"
  );
});

test("Tang halls include a wall-to-roof seal under the eaves", () => {
  assert.match(tangParts, /simpleHall_roofSeal/);
  assert.match(tangParts, /simpleHall_frontWall/);
  assert.match(tangParts, /simpleHall_backWall/);
});

test("Tang hall wall and column massing stays low under broad roofs", () => {
  assert.match(tangParts, /const bodyHeight = height \* 0\.5/);
  assert.match(tangParts, /buildColumn\(bodyHeight/);
  assert.match(tangParts, /const wallHeight = bodyHeight \* 0\.96/);
  assert.match(tangParts, /const bodyTopY = plinthHeight \+ bodyHeight/);
  assert.match(tangParts, /roof\.position\.y = bodyTopY/);
  assert.match(tangParts, /simpleHall_stonePlinth/);
});

test("two-story city halls use a belt roof instead of stacking two full halls", () => {
  assert.match(city, /buildBeltRoof/);
  assert.match(city, /city_twoStoryHall_beltRoof/);
  assert.doesNotMatch(city, /const lower = buildSimpleHall/);
  assert.doesNotMatch(city, /const upper = buildSimpleHall/);
});

test("small city houses are roofed buildings and large city inner wall is spacious", () => {
  assert.match(city, /city_house_roof/);
  assert.match(city, /function makeHouse[\s\S]*THREE\.Group/);
  assert.match(city, /const innerSide = outerSide \* 0\.7/);
});

test("node tower uses ring belt eaves that sit on each story wall", () => {
  assert.match(node, /buildTowerBeltRoof/);
  assert.match(node, /tower_beltRoof_/);
  assert.match(node, /eave\.position\.set\(x, y \+ thick \/ 2, z\)/);
  assert.match(node, /roof\.position\.set\(0, curY, 0\)/);
});

test("Tang roof palette is grey black rather than pure black", () => {
  assert.match(tangParts, /daiHei: 0x3f403b/);
});

test("city walls are continuous rammed-earth enclosures without corner towers", () => {
  assert.match(city, /buildContinuousCityWall/);
  assert.doesNotMatch(city, /placeGates/);
  assert.doesNotMatch(city, /city_gate_/);
});

test("city walls have a south gate tunnel with the wall connected above it", () => {
  assert.match(city, /const gateWidth = Math\.max\(wallThickness \* 2\.4, outerSide \* 0\.18\)/);
  assert.match(city, /const gateOpeningHeight = wallHeight \* 0\.62/);
  assert.match(city, /city_wall_south_west/);
  assert.match(city, /city_wall_south_east/);
  assert.match(city, /city_wall_south_door_lintel/);
  assert.match(city, /city_wall_south_gate_threshold/);
});

test("taoist temple removes gold roof disk and closes its courtyard wall", () => {
  assert.doesNotMatch(temple, /temple_taoist_goldDisk/);
  assert.doesNotMatch(temple, /buildCourtyardWalls\(group, "temple_taoist"/);
  assert.match(temple, /temple_taoist_frontPagoda/);
});

test("temple variants are simplified into one hall plus a front pagoda", () => {
  assert.match(temple, /temple_grand_middleHall/);
  assert.match(temple, /temple_grand_frontPagoda/);
  assert.match(temple, /temple_small_frontPagoda[\s\S]*pagoda\.position\.set\(0, 0, 0\.95\)/);
  assert.match(temple, /temple_grand_frontPagoda[\s\S]*pagoda\.position\.set\(0, 0, 1\.25\)/);
  assert.match(temple, /temple_taoist_frontPagoda[\s\S]*pagoda\.position\.set\(0, 0, 0\.95\)/);
  assert.doesNotMatch(temple, /temple_grand_mainHall/);
  assert.doesNotMatch(temple, /temple_grand_bellTower/);
  assert.doesNotMatch(temple, /temple_small_mainHall/);
  assert.doesNotMatch(temple, /temple_small_backWall/);
  assert.match(temple, /temple_small_frontPagoda/);
});

test("pass archetype is terrain-embedded and has no cone placeholder mountains", () => {
  assert.match(pass, /buildPassRockShoulder/);
  assert.match(pass, /buildPassRidge/);
  assert.match(pass, /pass_throat_path/);
  assert.doesNotMatch(
    pass,
    /new THREE\.CylinderGeometry\(\s*0\s*,/,
    "passes should use rock shoulders or ridges, not zero-top cone mountains"
  );
});

test("cave archetype presents a cliff facade with grotto rows", () => {
  assert.match(cave, /buildGrottoRow/);
  assert.match(cave, /cave_cliff_stratum/);
  assert.match(cave, /cave_plank_walkway/);
});

test("mausoleum archetype uses stepped rammed-earth mounds instead of pyramid peaks", () => {
  assert.match(mausoleum, /buildSteppedMound/);
  assert.match(mausoleum, /tomb_spiritPath/);
  assert.match(mausoleum, /mausoleum_tomb[\s\S]*group\.rotation\.y = Math\.PI/);
  assert.match(mausoleum, /mausoleum_imperial[\s\S]*group\.rotation\.y = Math\.PI/);
  assert.match(mausoleum, /group\.scale\.setScalar\(0\.5\)/);
  assert.doesNotMatch(
    mausoleum,
    /new THREE\.ConeGeometry\(0\.8,\s*0\.6,\s*4\)/,
    "common tomb should not use a small pyramid peak"
  );
  assert.doesNotMatch(
    mausoleum,
    /new THREE\.ConeGeometry\(0\.85,\s*0\.7,\s*4\)/,
    "imperial mound should not use a pyramid top"
  );
});

test("node tower is scaled down as a whole", () => {
  assert.match(node, /group\.scale\.setScalar\(0\.5\)/);
});

test("POI archetype demo shows world cardinal directions", () => {
  assert.match(poiDemo, /north = -Z/);
  assert.match(poiDemo, /N 北/);
  assert.match(poiDemo, /S 南/);
  assert.match(poiDemo, /E 东/);
  assert.match(poiDemo, /W 西/);
});
