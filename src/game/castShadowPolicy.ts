import { Object3D } from "three";

export const CAST_SHADOW_NAMES = new Set([
  // R8 预留 — Phase 4 实施 CSM 时按这个表设 castShadow=true。
  "avatar",
  "mount",
  "city-wall-instanced",
  "scenic-mesh",
  "ancient-mesh",
  "pass-landmark"
  // 不投影（远景 / 海量 instance / 本身扁平）：
  // "tree", "grass", "wildlife", "river-ribbon", "terrain-chunk"
]);

export const RECEIVE_SHADOW_NAMES = new Set([
  "terrain-chunk-near", // 玩家所在 chunk + 8 邻 chunk
  "city-floor",
  "scenic-base"
]);

function shadowPolicyKey(object: Object3D): string {
  const kind = object.userData.kind;
  return typeof kind === "string" && kind.length > 0 ? kind : object.name;
}

export function applyCastShadowPolicy(object: Object3D): void {
  object.traverse((child) => {
    const key = shadowPolicyKey(child);
    child.castShadow = CAST_SHADOW_NAMES.has(key);
    child.receiveShadow = RECEIVE_SHADOW_NAMES.has(key);
  });
}
