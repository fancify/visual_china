import * as THREE from "three";
import {
  TANG_PALETTE,
  buildSimpleHall,
} from "../tangParts.js";

/**
 * Cave archetype — 石窟.
 *
 * 唐风重做: 崖面是主体, 洞龛成排, 崖脚有栈道与小寺。
 */
export function buildCave(): THREE.Group {
  const group = new THREE.Group();
  group.name = "cave_default";

  const cliffMat = new THREE.MeshLambertMaterial({ color: TANG_PALETTE.shiHui });
  const darkMat = new THREE.MeshLambertMaterial({ color: TANG_PALETTE.daiHei });
  const woodMat = new THREE.MeshLambertMaterial({ color: TANG_PALETTE.muSe });
  const goldMat = new THREE.MeshLambertMaterial({ color: TANG_PALETTE.jinHuang });

  const cliff = new THREE.Group();
  cliff.name = "cave_cliff";
  const strata = [
    { w: 6.4, h: 1.2, y: 0.6, z: -0.05 },
    { w: 6.0, h: 1.15, y: 1.75, z: -0.12 },
    { w: 5.5, h: 1.05, y: 2.85, z: -0.18 },
    { w: 4.8, h: 0.9, y: 3.8, z: -0.26 },
  ];
  strata.forEach((spec, i) => {
    const stratum = new THREE.Mesh(new THREE.BoxGeometry(spec.w, spec.h, 0.5), cliffMat);
    stratum.name = `cave_cliff_stratum_${i}`;
    stratum.position.set(0, spec.y, spec.z);
    stratum.rotation.x = -Math.PI / 16;
    cliff.add(stratum);
  });
  group.add(cliff);

  buildGrottoRow(group, 0, 0.95, [-2.2, -1.25, -0.25, 0.95, 1.9], darkMat);
  buildGrottoRow(group, 1, 2.0, [-1.75, -0.75, 0.35, 1.45], darkMat);
  buildGrottoRow(group, 2, 3.05, [-1.1, 0.0, 1.1], darkMat);

  const walkway = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.08, 0.26), woodMat);
  walkway.name = "cave_plank_walkway";
  walkway.position.set(0, 0.42, 0.55);
  group.add(walkway);

  for (const x of [-2.4, -1.2, 0, 1.2, 2.4]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.38, 0.07), woodMat);
    post.name = "cave_walkway_post";
    post.position.set(x, 0.62, 0.66);
    group.add(post);
  }

  const buddha = new THREE.Group();
  buddha.name = "cave_buddha_niche";
  const niche = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.7, 0.18), darkMat);
  niche.name = "cave_buddha_dark_niche";
  niche.position.set(0, 1.38, 0.42);
  buddha.add(niche);
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.48, 1.15, 12), goldMat);
  body.name = "cave_buddha_body";
  body.position.set(0, 1.05, 0.58);
  buddha.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.28, 12, 8), goldMat);
  head.name = "cave_buddha_head";
  head.position.set(0, 1.78, 0.58);
  buddha.add(head);
  group.add(buddha);

  const hall = buildSimpleHall(1.35, 0.9, 0.95);
  hall.name = "cave_temple_hall";
  hall.position.set(2.15, 0, 1.45);
  group.add(hall);

  return group;
}

function buildGrottoRow(
  group: THREE.Group,
  row: number,
  y: number,
  xs: readonly number[],
  material: THREE.Material,
): void {
  xs.forEach((x, i) => {
    const width = row === 0 ? 0.48 : 0.38;
    const height = row === 0 ? 0.62 : 0.52;
    const grotto = new THREE.Mesh(new THREE.BoxGeometry(width, height, 0.18), material);
    grotto.name = `cave_grotto_row${row}_${i}`;
    grotto.position.set(x, y, 0.24);
    grotto.rotation.x = -Math.PI / 16;
    group.add(grotto);
  });
}
