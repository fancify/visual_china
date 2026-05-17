import * as THREE from "three";
import {
  TANG_PALETTE,
  buildPagoda,
  buildRammedEarthWall,
  buildSimpleHall,
} from "../tangParts.js";

/**
 * 关隘建筑原型 (pass / 关).
 *
 * 唐风重做: 关隘先是地形, 再是建筑。两侧用岩肩/山脊夹出山口,
 * 城墙贴山延伸, 关楼坐在门洞上, 不再用巨大锥体代表山体。
 */
export function buildPass(variant: "minor" | "major"): THREE.Group {
  const group = new THREE.Group();
  group.name = `pass_${variant}`;

  const isMajor = variant === "major";
  const throatWidth = isMajor ? 4.4 : 3.4;

  group.add(buildPassRockShoulder("pass_left_rock", -1, isMajor));
  group.add(buildPassRockShoulder("pass_right_rock", 1, isMajor));
  if (isMajor) {
    group.add(buildPassRidge("pass_left_ridge", -1));
    group.add(buildPassRidge("pass_right_ridge", 1));
  }

  const throat = new THREE.Mesh(
    new THREE.BoxGeometry(throatWidth, 0.04, isMajor ? 2.5 : 1.8),
    new THREE.MeshLambertMaterial({ color: 0x7f7564 }),
  );
  throat.name = "pass_throat_path";
  throat.position.y = 0.02;
  group.add(throat);

  const centerWall = buildRammedEarthWall(isMajor ? 4.2 : 3.2, isMajor ? 1.35 : 1.05, 0.55);
  centerWall.name = "pass_center_wall";
  group.add(centerWall);

  const gateTower = buildSimpleHall(isMajor ? 2.25 : 1.7, isMajor ? 1.35 : 1.0, isMajor ? 1.25 : 0.95);
  gateTower.name = "pass_gate_tower";
  gateTower.position.y = isMajor ? 1.26 : 0.98;
  group.add(gateTower);

  const gate = new THREE.Mesh(
    new THREE.BoxGeometry(isMajor ? 1.0 : 0.75, isMajor ? 0.95 : 0.72, 0.08),
    new THREE.MeshLambertMaterial({ color: TANG_PALETTE.muSe }),
  );
  gate.name = "pass_wooden_gate";
  gate.position.set(0, isMajor ? 0.48 : 0.36, 0.36);
  group.add(gate);

  if (isMajor) {
    const leftExtension = buildRammedEarthWall(2.5, 1.1, 0.45);
    leftExtension.name = "pass_wall_extension_left";
    leftExtension.position.set(-2.95, 0, -0.12);
    leftExtension.rotation.y = -0.16;
    group.add(leftExtension);

    const rightExtension = buildRammedEarthWall(2.5, 1.1, 0.45);
    rightExtension.name = "pass_wall_extension_right";
    rightExtension.position.set(2.95, 0, -0.12);
    rightExtension.rotation.y = 0.16;
    group.add(rightExtension);

    const beacon = buildPagoda(3, 0.42);
    beacon.name = "pass_beacon_tower";
    beacon.position.set(3.05, 1.35, -0.45);
    group.add(beacon);
  }

  return group;
}

function buildPassRockShoulder(name: string, side: -1 | 1, tall: boolean): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  const mat = new THREE.MeshLambertMaterial({ color: TANG_PALETTE.shiHui });
  const moss = new THREE.MeshLambertMaterial({ color: TANG_PALETTE.taiLv });
  const x = side * (tall ? 2.65 : 2.1);

  const lower = new THREE.Mesh(makeTaperedBlock(1.75, tall ? 2.25 : 1.75, 1.8, 0.72), mat);
  lower.name = `${name}_lower_mass`;
  lower.position.set(x, 0, 0);
  lower.rotation.z = side * 0.05;
  group.add(lower);

  const upper = new THREE.Mesh(makeTaperedBlock(1.18, tall ? 1.25 : 0.9, 1.25, 0.62), moss);
  upper.name = `${name}_weathered_cap`;
  upper.position.set(x + side * 0.12, tall ? 1.75 : 1.35, -0.08);
  upper.rotation.z = side * 0.08;
  group.add(upper);

  return group;
}

function buildPassRidge(name: string, side: -1 | 1): THREE.Group {
  const group = new THREE.Group();
  group.name = name;
  const ridge = new THREE.Mesh(
    makeTaperedBlock(2.8, 1.0, 1.45, 0.68),
    new THREE.MeshLambertMaterial({ color: TANG_PALETTE.shiHui }),
  );
  ridge.name = `${name}_long_slope`;
  ridge.position.set(side * 3.2, 0, -0.65);
  ridge.rotation.z = side * 0.16;
  ridge.rotation.y = side * 0.08;
  group.add(ridge);
  return group;
}

function makeTaperedBlock(width: number, height: number, depth: number, topScale: number): THREE.BufferGeometry {
  const hw = width / 2;
  const hd = depth / 2;
  const thw = hw * topScale;
  const thd = hd * topScale;
  const vertices = new Float32Array([
    -hw, 0, -hd, hw, 0, -hd, hw, 0, hd, -hw, 0, hd,
    -thw, height, -thd, thw, height, -thd, thw, height, thd, -thw, height, thd,
  ]);
  const indices = [
    0, 1, 2, 0, 2, 3,
    4, 7, 6, 4, 6, 5,
    0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2,
    2, 6, 7, 2, 7, 3,
    3, 7, 4, 3, 4, 0,
  ];
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}
