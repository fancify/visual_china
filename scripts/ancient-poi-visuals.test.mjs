import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile("src/main.ts", "utf8");

function expectSourceMatch(pattern, message) {
  assert.match(source, pattern, message);
}

test("ancient geometry constructors stay on the compact post-scenic scale", () => {
  expectSourceMatch(
    /bronzePodium:\s*new BoxGeometry\(0\.8,\s*0\.16,\s*0\.8\)/,
    "三星堆基座应该缩到 0.8 x 0.16 x 0.8"
  );
  expectSourceMatch(
    /bronzePillar:\s*new CylinderGeometry\(0\.05,\s*0\.06,\s*0\.7,\s*6\)/,
    "三星堆青铜柱应该缩到 0.05\/0.06 x 0.7"
  );
  expectSourceMatch(
    /bronzeCrossbar:\s*new BoxGeometry\(0\.30,\s*0\.06,\s*0\.06\)/,
    "三星堆横梁应该缩到 0.30 x 0.06 x 0.06"
  );
  expectSourceMatch(
    /jinshaPodium:\s*new BoxGeometry\(0\.7,\s*0\.12,\s*0\.7\)/,
    "金沙基座应该缩到 0.7 x 0.12 x 0.7"
  );
  expectSourceMatch(
    /sunBirdDisk:\s*new CylinderGeometry\(0\.25,\s*0\.25,\s*0\.02,\s*24\)/,
    "太阳神鸟金盘应该缩到半径 0.25、高 0.02"
  );
  expectSourceMatch(
    /yangshaoPlatform:\s*new CylinderGeometry\(0\.75,\s*0\.80,\s*0\.10,\s*18\)/,
    "仰韶平台应该缩到 0.75\/0.80 x 0.10"
  );
  expectSourceMatch(
    /yangshaoPost:\s*new CylinderGeometry\(0\.05,\s*0\.06,\s*0\.4,\s*6\)/,
    "仰韶立柱应该缩到 0.05\/0.06 x 0.4"
  );
  expectSourceMatch(
    /terracottaSoldier:\s*new CylinderGeometry\(0\.05,\s*0\.06,\s*0\.3,\s*6\)/,
    "兵马俑身体应该缩到 0.05\/0.06 x 0.3"
  );
  expectSourceMatch(
    /terracottaHead:\s*new SphereGeometry\(0\.05,\s*6,\s*6\)/,
    "兵马俑头部应该缩到半径 0.05"
  );
  expectSourceMatch(
    /terracottaPit:\s*new BoxGeometry\(1\.25,\s*0\.06,\s*0\.40\)/,
    "兵马俑坑应该缩到 1.25 x 0.06 x 0.40"
  );
  expectSourceMatch(
    /imperialTombMound:\s*buildImperialTombMound\(0\.6\)/,
    "帝陵封土应该走共享的 buildImperialTombMound(0.6)"
  );
});

test("ancient role offsets and array spacing stay on the compact scale", () => {
  expectSourceMatch(
    /addPiece\(new Mesh\(ancientGeometries\.bronzePodium, ancientMaterials\.earthFoundation\), 0\.08\);/,
    "三星堆基座 yOffset 应该缩到 0.08"
  );
  expectSourceMatch(
    /addPiece\(new Mesh\(ancientGeometries\.bronzePillar, ancientMaterials\.bronzeRelic\), 0\.52\);/,
    "三星堆立柱 yOffset 应该缩到 0.52"
  );
  expectSourceMatch(
    /addPiece\(new Mesh\(ancientGeometries\.bronzeCrossbar, ancientMaterials\.bronzeRelic\), 0\.85\);/,
    "三星堆横梁 yOffset 应该缩到 0.85"
  );
  expectSourceMatch(
    /addPiece\(new Mesh\(ancientGeometries\.jinshaPodium, ancientMaterials\.earthFoundation\), 0\.06\);/,
    "金沙基座 yOffset 应该缩到 0.06"
  );
  expectSourceMatch(
    /addPiece\(disk, 0\.39\);/,
    "太阳神鸟金盘 yOffset 应该缩到 0.39"
  );
  expectSourceMatch(
    /addPiece\(new Mesh\(ancientGeometries\.yangshaoPlatform, ancientMaterials\.rammedEarth\), 0\.05\);/,
    "仰韶平台 yOffset 应该缩到 0.05"
  );
  expectSourceMatch(
    /const postOffsets: Array<\[number, number\]> = \[\s*\[-0\.36, -0\.36\], \[0\.36, -0\.36\], \[-0\.36, 0\.36\], \[0\.36, 0\.36\]\s*\];/,
    "仰韶柱阵偏移应该按 0.30x 缩"
  );
  expectSourceMatch(
    /addPiece\(new Mesh\(ancientGeometries\.yangshaoPost, ancientMaterials\.woodPost\), 0\.30, dx, dz\);/,
    "仰韶立柱 yOffset 应该缩到 0.30"
  );
  expectSourceMatch(
    /addPiece\(new Mesh\(ancientGeometries\.terracottaPit, ancientMaterials\.earthFoundation\), 0\.03\);/,
    "兵马俑坑 yOffset 应该缩到 0.03"
  );
  expectSourceMatch(
    /const dx = -0\.525 \+ i \* 0\.21;/,
    "兵马俑阵列横向间距应该缩到 0.21"
  );
  expectSourceMatch(
    /new Mesh\(ancientGeometries\.terracottaSoldier, ancientMaterials\.terracottaClay\),\s*0\.18,/,
    "兵马俑身体 yOffset 应该缩到 0.18"
  );
  expectSourceMatch(
    /new Mesh\(ancientGeometries\.terracottaHead, ancientMaterials\.terracottaClay\),\s*0\.38,/,
    "兵马俑头部 yOffset 应该缩到 0.38"
  );
  expectSourceMatch(
    /new Mesh\(ancientGeometries\.imperialTombMound, ancientMaterials\.imperialTombEarth\),\s*0\s*\)/,
    "帝陵封土应该直接贴地放置，由几何自身提供阶梯高度"
  );
});

test("ancient label heights stay just above the compact meshes", () => {
  expectSourceMatch(/labelHeight = 1\.2;/, "三星堆 labelHeight 应该缩到 1.2");
  expectSourceMatch(/labelHeight = 0\.9;/, "金沙 labelHeight 应该缩到 0.9");
  expectSourceMatch(/labelHeight = 0\.75;/, "仰韶聚落 labelHeight 应该缩到 0.75");
  expectSourceMatch(/labelHeight = 0\.7;/, "兵马俑 labelHeight 应该缩到 0.7");
  expectSourceMatch(/labelHeight = 1\.5;/, "帝陵 labelHeight 应该缩到 1.5");
});

test("imperial tomb branch uses the shared stepped mound geometry", () => {
  expectSourceMatch(
    /if \(site\.role === "imperial-tomb"\)/,
    "imperial-tomb role branch should exist in rebuildAncientVisuals"
  );
  expectSourceMatch(
    /buildImperialTombMound\(0\.6\)/,
    "imperial-tomb role should build the shared stepped mound at 0.6 scale"
  );
  expectSourceMatch(
    /labelHeight = 1\.5;/,
    "imperial-tomb labelHeight should stay just above the stepped mound"
  );
});
