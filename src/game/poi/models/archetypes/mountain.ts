import * as THREE from "three";
import {
  TANG_PALETTE,
  buildHipRoof,
  buildColumn,
  buildStele,
} from "../tangParts.js";

/**
 * 山门 + 碑亭 archetype.
 * 占地约 2m × 2m × 2.5m (前后向沿 z 轴铺开)。
 * 前: 双柱 + 横梁 + 牌匾构成山门 (z=-0.5)
 * 后: 四柱碑亭 + 庑殿顶 + 内立石碑 (z=1)
 */
export function buildMountain(): THREE.Group {
  const group = new THREE.Group();
  group.name = "mountain_default";

  // ---- 山门 (z=-0.5) ----
  const gateZ = -0.5;
  const colL = buildColumn(2.0, TANG_PALETTE.zhuHong);
  colL.position.set(-0.8, 0, gateZ);
  group.add(colL);

  const colR = buildColumn(2.0, TANG_PALETTE.zhuHong);
  colR.position.set(0.8, 0, gateZ);
  group.add(colR);

  // 横梁: 黛黑漆
  const beamGeo = new THREE.BoxGeometry(2, 0.2, 0.2);
  const beamMat = new THREE.MeshLambertMaterial({ color: TANG_PALETTE.daiHei });
  const beam = new THREE.Mesh(beamGeo, beamMat);
  beam.name = "mountain_gate_beam";
  beam.position.set(0, 2.0, gateZ);
  group.add(beam);

  // 牌匾: 朱红底 + 微弱 emissive 标识题字
  const plaqueGeo = new THREE.BoxGeometry(1.4, 0.4, 0.05);
  const plaqueMat = new THREE.MeshLambertMaterial({
    color: TANG_PALETTE.zhuHong,
    emissive: TANG_PALETTE.jinHuang,
    emissiveIntensity: 0.15,
  });
  const plaque = new THREE.Mesh(plaqueGeo, plaqueMat);
  plaque.name = "mountain_gate_plaque";
  plaque.position.set(0, 1.7, gateZ + 0.13);
  group.add(plaque);

  // ---- 碑亭 (z=1) ----
  const paviCenterZ = 1.0;
  const pCols: Array<[number, number]> = [
    [-0.4, paviCenterZ - 0.4],
    [0.4, paviCenterZ - 0.4],
    [-0.4, paviCenterZ + 0.4],
    [0.4, paviCenterZ + 0.4],
  ];
  for (const [x, z] of pCols) {
    const c = buildColumn(1.2, TANG_PALETTE.zhuHong);
    c.position.set(x, 0, z);
    group.add(c);
  }

  // 庑殿顶
  const roof = buildHipRoof(1.0, 1.0, 0.4);
  roof.name = "mountain_pavilion_roof";
  roof.position.set(0, 1.4, paviCenterZ);
  group.add(roof);

  // 内立石碑
  const stele = buildStele(0.6);
  stele.name = "mountain_pavilion_stele";
  stele.position.set(0, 0, paviCenterZ);
  group.add(stele);

  return group;
}
