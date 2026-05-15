import * as THREE from "three";
import {
  TANG_PALETTE,
  buildSimpleHall,
} from "../tangParts.js";

/**
 * Cave archetype — 石窟 (e.g. 敦煌莫高窟 / 龙门 / 云冈 风格)
 *
 * 设计:
 * - 倾斜山崖墙面 (~6m 宽 × 4m 高), 灰白 shiHui
 * - 崖面上 5–7 个黑色窟口 (daiHei), 半嵌入崖体
 * - 崖前露天大佛 (莲花座 + 锥形身 + 球形头, jinHuang 鎏金)
 * - 崖下一座小寺院 (buildSimpleHall)
 * - 崖底散布 5 株苔绿杂草
 */
export function buildCave(): THREE.Group {
  const group = new THREE.Group();
  group.name = "cave_default";

  // 1. 倾斜山崖墙面 (后倾约 22.5°)
  const cliffMat = new THREE.MeshLambertMaterial({ color: TANG_PALETTE.shiHui });
  const cliffGeo = new THREE.BoxGeometry(6, 4, 0.5);
  const cliff = new THREE.Mesh(cliffGeo, cliffMat);
  cliff.name = "cave_cliff";
  cliff.position.set(0, 2, 0);
  cliff.rotation.x = -Math.PI / 8;
  group.add(cliff);

  // 2. 5–7 个窟口 (daiHei 黛黑), 半嵌入崖面
  const grottoMat = new THREE.MeshLambertMaterial({ color: TANG_PALETTE.daiHei });
  const grottoPositions: ReadonlyArray<readonly [number, number]> = [
    [-1.8, 1.0],
    [-0.9, 2.4],
    [0.1, 1.3],
    [0.4, 3.0],
    [1.3, 0.7],
    [1.7, 2.1],
  ];
  grottoPositions.forEach(([x, y], i) => {
    const grottoGeo = new THREE.BoxGeometry(0.5, 0.7, 0.3);
    const grotto = new THREE.Mesh(grottoGeo, grottoMat);
    grotto.name = `cave_grotto_${i}`;
    // 嵌入崖面 (cliff 旋转 -PI/8, z=-0.15 表示沿崖面法线内嵌)
    grotto.position.set(x, y, -0.15);
    // 跟随崖面倾斜方向
    grotto.rotation.x = -Math.PI / 8;
    group.add(grotto);
  });

  // 3. 露天大佛 (中央 x=0)
  const buddhaMat = new THREE.MeshLambertMaterial({ color: TANG_PALETTE.jinHuang });
  const lotusMat = new THREE.MeshLambertMaterial({ color: TANG_PALETTE.shiHui });

  // 3a. 莲花座 (8 瓣)
  const lotusGeo = new THREE.CylinderGeometry(0.7, 0.6, 0.3, 8);
  const lotus = new THREE.Mesh(lotusGeo, lotusMat);
  lotus.name = "cave_buddha_lotus";
  lotus.position.set(0, 0.5, 1.5);
  group.add(lotus);

  // 3b. 身体 (锥形袈裟)
  const bodyGeo = new THREE.ConeGeometry(0.6, 2, 12);
  const body = new THREE.Mesh(bodyGeo, buddhaMat);
  body.name = "cave_buddha_body";
  body.position.set(0, 1.5, 1.5);
  group.add(body);

  // 3c. 头 (球形)
  const headGeo = new THREE.SphereGeometry(0.4, 16, 12);
  const head = new THREE.Mesh(headGeo, buddhaMat);
  head.name = "cave_buddha_head";
  head.position.set(0, 2.7, 1.5);
  group.add(head);

  // 4. 山崖下小寺院 (右前方)
  const hall = buildSimpleHall(1.5, 1, 1.2);
  hall.name = "cave_temple_hall";
  hall.position.set(1.5, 0, 2);
  group.add(hall);

  // 5. 杂草 5 株 (苔绿, 散布崖下)
  const grassMat = new THREE.MeshLambertMaterial({ color: TANG_PALETTE.taiLv });
  const grassPositions: ReadonlyArray<readonly [number, number]> = [
    [-1.7, 1.2],
    [-0.8, 2.6],
    [0.5, 1.6],
    [1.1, 2.9],
    [1.9, 1.4],
  ];
  grassPositions.forEach(([x, z], i) => {
    const grassGeo = new THREE.ConeGeometry(0.1, 0.2, 4);
    const grass = new THREE.Mesh(grassGeo, grassMat);
    grass.name = `cave_grass_${i}`;
    grass.position.set(x, 0.1, z);
    group.add(grass);
  });

  return group;
}
