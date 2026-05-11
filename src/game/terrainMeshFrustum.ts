import type { BufferGeometry, Mesh } from "three";

// streamed chunk 的树是 terrain mesh 的子节点。即使子节点自己
// frustumCulled=false，只要父 terrain mesh 被裁掉，整棵子树还是一起消失。
// 这里统一把 chunk terrain 的包围体刷新一次，并直接关闭父 mesh 的裁剪。
export function configureChunkTerrainFrustum(
  mesh: Mesh,
  geometry: BufferGeometry
): void {
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  mesh.frustumCulled = false;
}
