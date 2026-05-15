import * as THREE from "three";
import {
  TANG_PALETTE,
  buildRammedEarthWall,
  buildStele,
} from "../tangParts.js";

/**
 * 废墟 archetype.
 * 占地约 4m × 4m × 1.5m。
 * 3 段残破夯土墙 + 2 组倒柱础 + 杂草 + 残碑。
 */
export function buildRuin(): THREE.Group {
  const group = new THREE.Group();
  group.name = "ruin_default";

  // ---- 残破夯土 (3 段) ----
  const wallA = buildRammedEarthWall(2, 1.2, 0.5, true);
  wallA.name = "ruin_wall_a";
  wallA.position.set(-1, 0, 0);
  group.add(wallA);

  const wallB = buildRammedEarthWall(1.5, 0.8, 0.5, true);
  wallB.name = "ruin_wall_b";
  wallB.position.set(1, 0, 1);
  wallB.rotateY(Math.PI / 8);
  group.add(wallB);

  const wallC = buildRammedEarthWall(1.8, 1.0, 0.5, true);
  wallC.name = "ruin_wall_c";
  wallC.position.set(0, 0, -1.5);
  wallC.rotateY(-Math.PI / 12);
  group.add(wallC);

  // ---- 倒柱础 (2 组) ----
  const baseMat = new THREE.MeshLambertMaterial({
    color: TANG_PALETTE.shiHui,
  });
  const pillarMat = new THREE.MeshLambertMaterial({
    color: TANG_PALETTE.zhuHong,
  });

  // 组 1
  const base1 = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.3, 0.4),
    baseMat,
  );
  base1.name = "ruin_base_1";
  base1.position.set(-0.5, 0.15, 0);
  group.add(base1);

  const pillar1 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 1.2, 8),
    pillarMat,
  );
  pillar1.name = "ruin_pillar_1";
  pillar1.rotateZ(Math.PI / 2);
  pillar1.position.set(0.2, 0.15, 0);
  group.add(pillar1);

  // 组 2
  const base2 = new THREE.Mesh(
    new THREE.BoxGeometry(0.4, 0.3, 0.4),
    baseMat,
  );
  base2.name = "ruin_base_2";
  base2.position.set(1.5, 0.15, -0.5);
  group.add(base2);

  const pillar2 = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, 1.0, 8),
    pillarMat,
  );
  pillar2.name = "ruin_pillar_2";
  pillar2.rotateZ(Math.PI / 2 - 0.3);
  pillar2.position.set(1.8, 0.15, -0.5);
  group.add(pillar2);

  // ---- 杂草 (6 个) ----
  const grassMat = new THREE.MeshLambertMaterial({
    color: TANG_PALETTE.taiLv,
  });
  const grassPositions: Array<[number, number]> = [
    [-1.2, 0.4],
    [0.6, -0.8],
    [1.2, 0.4],
    [-0.3, 1.5],
    [0.9, 1.8],
    [-1.6, -0.4],
  ];
  for (let i = 0; i < grassPositions.length; i++) {
    const pos = grassPositions[i]!;
    const blade = new THREE.Mesh(
      new THREE.ConeGeometry(0.1, 0.3, 4),
      grassMat,
    );
    blade.name = `ruin_grass_${i}`;
    blade.position.set(pos[0], 0.15, pos[1]);
    group.add(blade);
  }

  // ---- 残碑 (顶部 cap 缺失, 略倾斜) ----
  const brokenStele = buildStele(0.5);
  brokenStele.name = "ruin_broken_stele";
  brokenStele.position.set(-1.5, 0, 1.2);
  brokenStele.rotateZ(0.15);
  // 移除顶部 cap (若有命名 stele_cap 的子 mesh)
  const cap = brokenStele.getObjectByName("stele_cap");
  if (cap && cap.parent) {
    cap.parent.remove(cap);
  }
  // 在断口处加一个错位的小石块以示断裂
  const stub = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.08, 0.12),
    new THREE.MeshLambertMaterial({ color: TANG_PALETTE.shiHui }),
  );
  stub.name = "ruin_stele_stub";
  stub.position.set(0.05, 0.5, 0);
  stub.rotateZ(-0.4);
  brokenStele.add(stub);
  group.add(brokenStele);

  return group;
}
