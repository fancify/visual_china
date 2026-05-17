/**
 * POI model registry — resolver 把 registry entry 映射到 3D model builder.
 *
 * 解析顺序: id-override > archetype + (size | variant) > archetype.default
 *
 * Phase 2 当前只填 archetype 默认; Phase 3 加 individual override (长安 / 莫高窟 等).
 */

import * as THREE from "three";

import { buildCity } from "./archetypes/city.js";
import { buildMountain } from "./archetypes/mountain.js";
import { buildMausoleum } from "./archetypes/mausoleum.js";
import { buildRuin } from "./archetypes/ruin.js";
import { buildPass } from "./archetypes/pass.js";
import { buildTemple } from "./archetypes/temple.js";
import { buildCave } from "./archetypes/cave.js";
import { buildNode } from "./archetypes/node.js";

export type PoiModelBuilder = () => THREE.Group;

export interface PoiModelEntry {
  readonly id: string;
  readonly archetype: string;
  readonly size?: string;
  readonly variant?: string;
}

const ARCHETYPES: Record<string, Record<string, PoiModelBuilder>> = {
  city: {
    small: () => buildCity("small"),
    medium: () => buildCity("medium"),
    large: () => buildCity("large"),
    default: () => buildCity("medium"),
  },
  mountain: {
    default: () => buildMountain(),
  },
  mausoleum: {
    tomb: () => buildMausoleum("tomb"),
    imperial: () => buildMausoleum("imperial"),
    default: () => buildMausoleum("tomb"),
  },
  ruin: {
    default: () => buildRuin(),
  },
  pass: {
    minor: () => buildPass("minor"),
    major: () => buildPass("major"),
    default: () => buildPass("minor"),
  },
  temple: {
    small_temple: () => buildTemple("small_temple"),
    grand: () => buildTemple("grand"),
    taoist: () => buildTemple("taoist"),
    default: () => buildTemple("small_temple"),
  },
  cave: {
    default: () => buildCave(),
  },
  node: {
    bridge: () => buildNode("bridge"),
    ferry: () => buildNode("ferry"),
    port: () => buildNode("port"),
    tower: () => buildNode("tower"),
    default: () => buildNode("tower"),
  },
};

// Phase 3 加专属 override
const OVERRIDES: Record<string, PoiModelBuilder> = {};

/**
 * 主 resolver. 当 archetype 不识别或 variant/size 都不匹配时, 返回空 Group fallback.
 */
export function resolvePoiModel(entry: PoiModelEntry): PoiModelBuilder {
  const override = OVERRIDES[entry.id];
  if (override) return override;

  const archetypeMap = ARCHETYPES[entry.archetype];
  if (!archetypeMap) return () => new THREE.Group();

  const key = entry.size ?? entry.variant ?? "default";
  return archetypeMap[key] ?? archetypeMap.default ?? (() => new THREE.Group());
}

/**
 * 列出所有 archetype + variant/size 的 demo entries (供 demo scene 用).
 */
export function listAllArchetypeVariants(): readonly PoiModelEntry[] {
  return [
    { id: "demo_city_small", archetype: "city", size: "small" },
    { id: "demo_city_medium", archetype: "city", size: "medium" },
    { id: "demo_city_large", archetype: "city", size: "large" },
    { id: "demo_mountain", archetype: "mountain" },
    { id: "demo_mausoleum_tomb", archetype: "mausoleum", variant: "tomb" },
    { id: "demo_mausoleum_imperial", archetype: "mausoleum", variant: "imperial" },
    { id: "demo_ruin", archetype: "ruin" },
    { id: "demo_pass_minor", archetype: "pass", variant: "minor" },
    { id: "demo_pass_major", archetype: "pass", variant: "major" },
    { id: "demo_temple_small", archetype: "temple", variant: "small_temple" },
    { id: "demo_temple_grand", archetype: "temple", variant: "grand" },
    { id: "demo_temple_taoist", archetype: "temple", variant: "taoist" },
    { id: "demo_cave", archetype: "cave" },
    { id: "demo_node_bridge", archetype: "node", variant: "bridge" },
    { id: "demo_node_ferry", archetype: "node", variant: "ferry" },
    { id: "demo_node_port", archetype: "node", variant: "port" },
    { id: "demo_node_tower", archetype: "node", variant: "tower" },
  ] as const;
}
