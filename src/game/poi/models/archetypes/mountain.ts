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

  // 横梁 (碑亭柱顶一圈, 4 边, muSe 木色) — 让屋顶有承重感
  const beamH = 0.1;
  const paviBeamY = 1.15;
  const paviBeamMat = new THREE.MeshLambertMaterial({ color: TANG_PALETTE.muSe });
  // 前梁 + 后梁 (沿 x)
  const beamFG = new THREE.BoxGeometry(0.95, beamH, beamH);
  const beamFM = new THREE.Mesh(beamFG, paviBeamMat);
  beamFM.position.set(0, paviBeamY, paviCenterZ + 0.4);
  beamFM.name = "mountain_pavilion_beam_front";
  group.add(beamFM);
  const beamBG = new THREE.BoxGeometry(0.95, beamH, beamH);
  const beamBM = new THREE.Mesh(beamBG, paviBeamMat);
  beamBM.position.set(0, paviBeamY, paviCenterZ - 0.4);
  beamBM.name = "mountain_pavilion_beam_back";
  group.add(beamBM);
  // 左右梁 (沿 z)
  const beamLG = new THREE.BoxGeometry(beamH, beamH, 0.95);
  const beamLM = new THREE.Mesh(beamLG, paviBeamMat);
  beamLM.position.set(-0.4, paviBeamY, paviCenterZ);
  beamLM.name = "mountain_pavilion_beam_left";
  group.add(beamLM);
  const beamRG = new THREE.BoxGeometry(beamH, beamH, 0.95);
  const beamRM = new THREE.Mesh(beamRG, paviBeamMat);
  beamRM.position.set(0.4, paviBeamY, paviCenterZ);
  beamRM.name = "mountain_pavilion_beam_right";
  group.add(beamRM);

  // 庑殿顶 — 紧贴梁顶 (而不是悬浮)
  const roof = buildHipRoof(1.0, 1.0, 0.4);
  roof.name = "mountain_pavilion_roof";
  roof.position.set(0, 1.2, paviCenterZ); // 1.2 = 梁顶
  group.add(roof);

  // 内立石碑
  const stele = buildStele(0.6);
  stele.name = "mountain_pavilion_stele";
  stele.position.set(0, 0, paviCenterZ);
  group.add(stele);

  return group;
}
