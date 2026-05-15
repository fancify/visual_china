/**
 * Temple archetype builder.
 *
 * 3 variants:
 *   - small_temple: 小殿 + 前方小塔
 *   - grand:       中殿 + 前方中型塔
 *   - taoist:      小殿 + 前方小塔
 *
 * 复用 tangParts: buildSimpleHall, buildPagoda.
 */

import * as THREE from "three";
import {
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

  const hall = buildSimpleHall(1.05, 0.72, 0.68);
  hall.name = "temple_small_hall";
  hall.position.set(0, 0, 0.35);
  group.add(hall);

  const pagoda = buildPagoda(2, 0.32);
  pagoda.name = "temple_small_frontPagoda";
  pagoda.position.set(0, 0, 0.95);
  group.add(pagoda);

  return group;
}

// ──────────────────────────────────────────────────────────────────────────
// grand (~6m): 山门 + 前殿 + 大殿 + 钟鼓楼 + 5 层塔
// ──────────────────────────────────────────────────────────────────────────

function buildGrandTemple(): THREE.Group {
  const group = new THREE.Group();
  group.name = "temple_grand";

  const hall = buildSimpleHall(1.65, 1.05, 0.95);
  hall.name = "temple_grand_middleHall";
  hall.position.set(0, 0, 0.55);
  group.add(hall);

  const pagoda = buildPagoda(4, 0.5);
  pagoda.name = "temple_grand_frontPagoda";
  pagoda.position.set(0, 0, 1.25);
  group.add(pagoda);

  return group;
}

// ──────────────────────────────────────────────────────────────────────────
// taoist (~4m): 山门 + 三清殿 + 道院围墙 + 小方塔 + 八卦圆盘
// ──────────────────────────────────────────────────────────────────────────

function buildTaoistTemple(): THREE.Group {
  const group = new THREE.Group();
  group.name = "temple_taoist";

  const hall = buildSimpleHall(1.05, 0.74, 0.68);
  hall.name = "temple_taoist_hall";
  hall.position.set(0, 0, 0.35);
  group.add(hall);

  const pagoda = buildPagoda(2, 0.32);
  pagoda.name = "temple_taoist_frontPagoda";
  pagoda.position.set(0, 0, 0.95);
  group.add(pagoda);

  return group;
}
