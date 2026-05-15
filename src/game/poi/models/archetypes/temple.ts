/**
 * Temple archetype builder.
 *
 * 3 variants:
 *   - small_temple: 山门 + 大殿 + 短围墙 (~3m)
 *   - grand:       山门 + 前殿 + 大殿 + 钟鼓楼 + 5 层塔 (~6m)
 *   - taoist:      山门 + 三清殿 + 道院围墙 + 小方塔 + 八卦图 (~4m)
 *
 * 复用 tangParts: buildSimpleHall, buildRammedEarthWall, buildPagoda.
 */

import * as THREE from "three";
import {
  TANG_PALETTE,
  buildRammedEarthWall,
  buildPagoda,
  buildSimpleHall,
} from "../tangParts.js";

export type TempleVariant = "small_temple" | "grand" | "taoist";

/**
 * Build a Tang-style 寺/观 complex.
 *
 * @param variant 三种规模/形制: small_temple | grand | taoist
 * @returns       THREE.Group, name = `temple_<variant>`
 */
export function buildTemple(variant: TempleVariant): THREE.Group {
  switch (variant) {
    case "small_temple":
      return buildSmallTemple();
    case "grand":
      return buildGrandTemple();
    case "taoist":
      return buildTaoistTemple();
    default: {
      // exhaustive check
      const _exhaustive: never = variant;
      return _exhaustive;
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// small_temple (~3m): 山门 + 大殿 + 短围墙
// ──────────────────────────────────────────────────────────────────────────

function buildSmallTemple(): THREE.Group {
  const group = new THREE.Group();
  group.name = "temple_small_temple";

  // 山门 (front gate, 矮小)
  const gate = buildSimpleHall(1.2, 0.6, 0.7);
  gate.name = "temple_small_gate";
  gate.position.set(0, 0, -1.0);
  group.add(gate);

  // 大殿 (main hall, 中等, 后置)
  const mainHall = buildSimpleHall(1.6, 1.0, 1.0);
  mainHall.name = "temple_small_mainHall";
  mainHall.position.set(0, 0, 0.6);
  group.add(mainHall);

  // 短墙 — 左右各一段
  const leftWall = buildRammedEarthWall(2.2, 0.5, 0.12);
  leftWall.name = "temple_small_leftWall";
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-1.0, 0, -0.2);
  group.add(leftWall);

  const rightWall = buildRammedEarthWall(2.2, 0.5, 0.12);
  rightWall.name = "temple_small_rightWall";
  rightWall.rotation.y = Math.PI / 2;
  rightWall.position.set(1.0, 0, -0.2);
  group.add(rightWall);

  // 后墙 (封闭)
  const backWall = buildRammedEarthWall(2.0, 0.5, 0.12);
  backWall.name = "temple_small_backWall";
  backWall.position.set(0, 0, 1.2);
  group.add(backWall);

  return group;
}

// ──────────────────────────────────────────────────────────────────────────
// grand (~6m): 山门 + 前殿 + 大殿 + 钟鼓楼 + 5 层塔
// ──────────────────────────────────────────────────────────────────────────

function buildGrandTemple(): THREE.Group {
  const group = new THREE.Group();
  group.name = "temple_grand";

  // 山门 (前置)
  const gate = buildSimpleHall(2.0, 1.0, 1.2);
  gate.name = "temple_grand_gate";
  gate.position.set(0, 0, -2.5);
  group.add(gate);

  // 前殿
  const frontHall = buildSimpleHall(2.4, 1.4, 1.4);
  frontHall.name = "temple_grand_frontHall";
  frontHall.position.set(0, 0, -0.4);
  group.add(frontHall);

  // 大殿 (最大, 后置)
  const mainHall = buildSimpleHall(3.0, 1.8, 1.8);
  mainHall.name = "temple_grand_mainHall";
  mainHall.position.set(0, 0, 1.8);
  group.add(mainHall);

  // 钟楼 (左) — 小 simpleHall + 单层 pagoda 顶
  const bellTower = new THREE.Group();
  bellTower.name = "temple_grand_bellTower";
  const bellHall = buildSimpleHall(0.8, 0.8, 1.0);
  bellTower.add(bellHall);
  const bellRoof = buildPagoda(3, 0.6);
  bellRoof.position.y = 1.0;
  bellTower.add(bellRoof);
  bellTower.position.set(-2.2, 0, -0.4);
  group.add(bellTower);

  // 鼓楼 (右) — 镜像
  const drumTower = new THREE.Group();
  drumTower.name = "temple_grand_drumTower";
  const drumHall = buildSimpleHall(0.8, 0.8, 1.0);
  drumTower.add(drumHall);
  const drumRoof = buildPagoda(3, 0.6);
  drumRoof.position.y = 1.0;
  drumTower.add(drumRoof);
  drumTower.position.set(2.2, 0, -0.4);
  group.add(drumTower);

  // 5 层塔 (后院偏侧)
  const pagoda = buildPagoda(5, 1.0);
  pagoda.name = "temple_grand_pagoda";
  pagoda.position.set(-2.5, 0, 2.4);
  group.add(pagoda);

  return group;
}

// ──────────────────────────────────────────────────────────────────────────
// taoist (~4m): 山门 + 三清殿 + 道院围墙 + 小方塔 + 八卦圆盘
// ──────────────────────────────────────────────────────────────────────────

function buildTaoistTemple(): THREE.Group {
  const group = new THREE.Group();
  group.name = "temple_taoist";

  // 山门
  const gate = buildSimpleHall(1.4, 0.8, 0.9);
  gate.name = "temple_taoist_gate";
  gate.position.set(0, 0, -1.4);
  group.add(gate);

  // 三清殿 (中央大殿) + 顶部金色圆盘装饰
  const sanqingHall = buildSimpleHall(2.0, 1.4, 1.4);
  sanqingHall.name = "temple_taoist_sanqingHall";
  sanqingHall.position.set(0, 0, 0.8);
  group.add(sanqingHall);

  // 三清殿顶部金色圆盘 (emissive)
  const goldDiskMat = new THREE.MeshLambertMaterial({
    color: TANG_PALETTE.jinHuang,
    emissive: TANG_PALETTE.jinHuang,
    emissiveIntensity: 0.4,
  });
  const goldDiskGeom = new THREE.CylinderGeometry(0.28, 0.28, 0.08, 16);
  const goldDisk = new THREE.Mesh(goldDiskGeom, goldDiskMat);
  goldDisk.name = "temple_taoist_goldDisk";
  goldDisk.position.set(0, 2.1, 0.8);
  group.add(goldDisk);

  // 道院围墙 (四面短墙)
  const wallLength = 3.6;
  const wallH = 0.55;
  const wallT = 0.12;

  const leftWall = buildRammedEarthWall(wallLength, wallH, wallT);
  leftWall.name = "temple_taoist_leftWall";
  leftWall.rotation.y = Math.PI / 2;
  leftWall.position.set(-1.4, 0, 0);
  group.add(leftWall);

  const rightWall = buildRammedEarthWall(wallLength, wallH, wallT);
  rightWall.name = "temple_taoist_rightWall";
  rightWall.rotation.y = Math.PI / 2;
  rightWall.position.set(1.4, 0, 0);
  group.add(rightWall);

  const backWall = buildRammedEarthWall(2.6, wallH, wallT);
  backWall.name = "temple_taoist_backWall";
  backWall.position.set(0, 0, 1.7);
  group.add(backWall);

  // 小方塔 (3 层) — 用 hangHuang 夯黄色身漆覆盖朱红
  const pagoda = buildPagoda(3, 0.5);
  pagoda.name = "temple_taoist_pagoda";
  // 重漆塔身为 hangHuang (朴素)
  pagoda.traverse((obj) => {
    if (obj instanceof THREE.Mesh && obj.name.startsWith("pagoda_body_")) {
      const mat = obj.material;
      if (mat instanceof THREE.MeshLambertMaterial) {
        mat.color.setHex(TANG_PALETTE.hangHuang);
      }
    }
  });
  pagoda.position.set(1.5, 0, 1.5);
  group.add(pagoda);

  // 中央地面八卦圆盘 (黑黄 emissive)
  const baguaMat = new THREE.MeshLambertMaterial({
    color: TANG_PALETTE.daiHei,
    emissive: TANG_PALETTE.jinHuang,
    emissiveIntensity: 0.25,
  });
  const baguaGeom = new THREE.CylinderGeometry(0.5, 0.5, 0.04, 16);
  const bagua = new THREE.Mesh(baguaGeom, baguaMat);
  bagua.name = "temple_taoist_bagua";
  bagua.position.set(0, 0.02, -0.3);
  group.add(bagua);

  return group;
}
