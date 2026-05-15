import * as THREE from "three";
import {
  TANG_PALETTE,
  buildHipRoof,
  buildRammedEarthWall,
  buildSimpleHall,
  buildPagoda,
  buildColumn,
} from "../tangParts.js";

// 共通几何资源 (lazy reuse via local consts inside function to keep file simple)

/**
 * 关隘建筑原型 (pass / 关).
 *
 * 共通: 两侧 placeholder 山 (CylinderGeometry 8-segment cone) + 中间夯土城墙.
 *
 * - minor: 单座关楼 + 木栅门
 * - major: 双层关楼 + 更高山 + 左右延伸长城 + 右山顶烽燧
 *
 * @param variant 'minor' | 'major'
 * @returns THREE.Group, name = "pass_" + variant
 */
export function buildPass(variant: "minor" | "major"): THREE.Group {
  const group = new THREE.Group();
  group.name = `pass_${variant}`;

  const isMajor = variant === "major";
  const mountainHeight = isMajor ? 8 : 5.5;
  const mountainRadius = 2;
  const mountainSpacing = 4; // 左右山中心间距

  // ----- 两侧山 (placeholder cone) -----
  const mountainGeom = new THREE.CylinderGeometry(
    0,
    mountainRadius,
    mountainHeight,
    8,
  );
  const mountainMat = new THREE.MeshStandardMaterial({
    color: TANG_PALETTE.shiHui,
    roughness: 0.95,
    metalness: 0,
  });

  const leftMountain = new THREE.Mesh(mountainGeom, mountainMat);
  leftMountain.name = "pass_mountain_left";
  leftMountain.position.set(-mountainSpacing / 2, mountainHeight / 2, 0);
  group.add(leftMountain);

  const rightMountain = new THREE.Mesh(mountainGeom, mountainMat);
  rightMountain.name = "pass_mountain_right";
  rightMountain.position.set(mountainSpacing / 2, mountainHeight / 2, 0);
  group.add(rightMountain);

  // ----- 中间夯土城墙 -----
  const centerWall = buildRammedEarthWall(4, 1.5, 0.6);
  centerWall.name = "pass_center_wall";
  centerWall.position.set(0, 0, 0);
  group.add(centerWall);

  if (!isMajor) {
    // ----- minor: 单座关楼 -----
    const gateTower = buildSimpleHall(2, 1.5, 2);
    gateTower.name = "pass_gate_tower";
    // 关楼坐落于城墙上方 (城墙高 1.5)
    gateTower.position.set(0, 1.5, 0);
    group.add(gateTower);

    // 木栅门: 1 个 muSe BoxGeometry plane, 在关楼前
    const gateGeom = new THREE.BoxGeometry(1, 1.2, 0.1);
    const gateMat = new THREE.MeshStandardMaterial({
      color: TANG_PALETTE.muSe,
      roughness: 0.85,
      metalness: 0,
    });
    const woodenGate = new THREE.Mesh(gateGeom, gateMat);
    woodenGate.name = "pass_wooden_gate";
    // 关楼前方 (z 正向, 离开城墙一点点)
    woodenGate.position.set(0, 0.6, 0.4);
    group.add(woodenGate);
  } else {
    // ----- major: 双层关楼 -----
    const lowerHall = buildSimpleHall(2.5, 2, 2);
    lowerHall.name = "pass_gate_tower_lower";
    lowerHall.position.set(0, 0, 0);
    group.add(lowerHall);

    const upperHall = buildSimpleHall(2.5, 2, 2);
    upperHall.name = "pass_gate_tower_upper";
    upperHall.position.set(0, 2, 0);
    group.add(upperHall);

    // 左右延伸长城: 各加 1 段 buildRammedEarthWall(3, 1.5, 0.6)
    // 中心城墙长 4, 左右延伸段长 3, 沿 x 轴对齐
    const leftExtension = buildRammedEarthWall(3, 1.5, 0.6);
    leftExtension.name = "pass_wall_extension_left";
    // 中心城墙左端 = -2, 延伸段中心 = -2 - 1.5 = -3.5
    leftExtension.position.set(-3.5, 0, 0);
    group.add(leftExtension);

    const rightExtension = buildRammedEarthWall(3, 1.5, 0.6);
    rightExtension.name = "pass_wall_extension_right";
    rightExtension.position.set(3.5, 0, 0);
    group.add(rightExtension);

    // 烽燧 (单座 pagoda) 在右山顶, 旁靠右山 base
    const beacon = buildPagoda(1, 0.8);
    beacon.name = "pass_beacon_tower";
    // 右山在 x = +2, 山高 8m -> y=4 处贴右山 base 侧
    beacon.position.set(mountainSpacing / 2, 4, 0);
    group.add(beacon);
  }

  // 触发引用以避免未使用警告 (buildHipRoof / buildColumn 当前 variant 未直接使用)
  // 保留 import 以备后续 variant 扩展;若 TS 严格 unused-import 报错由 tsconfig 决定.
  void buildHipRoof;
  void buildColumn;

  return group;
}
