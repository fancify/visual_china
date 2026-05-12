// terrain/ — P3 新 renderer module
//
// 入口：bootstrapPyramidTerrain() — 给 main.ts 在 feature flag 下 调用
// 不破旧 SurfaceProvider 接口；新 PyramidSurfaceProvider 是 plug-in 替代
//
// 模块拓扑:
//   pyramidTypes.ts             — 数据类型
//   pyramidDecode.ts            — Float16 解码
//   pyramidLoader.ts            — chunk 加载 + LRU cache
//   pyramidSampler.ts           — world(x,z) → height bilinear 查询
//   pyramidMesh.ts              — chunk → Three.js BufferGeometry + Mesh
//   pyramidSurfaceProvider.ts   — 实现旧 SurfaceProvider 接口
//   pyramidBootstrap.ts         — 一站式入口
//
// 待补 (P3 续):
//   morphShader.ts      — tier 间 LOD morph (vertex shader)
//   riverRenderer.ts    — ribbon mesh (HydroRIVERS overlay)
//   oceanRenderer.ts    — sea-level plane + coast mask
//
// 待补 (P4-P6):
//   atmosphereShader.ts — distance fog + air scatter
//   materialShader.ts   — slope-driven (岩/草/沙/雪)

export { PyramidLoader } from "./pyramidLoader.js";
export { PyramidSampler } from "./pyramidSampler.js";
export { PyramidSurfaceProvider } from "./pyramidSurfaceProvider.js";
export {
  createPyramidChunkMesh,
  disposePyramidChunkMesh
} from "./pyramidMesh.js";
export { bootstrapPyramidTerrain } from "./pyramidBootstrap.js";
export { decodePyramidChunk, float16ToFloat32 } from "./pyramidDecode.js";
export { RiverLoader } from "./riverRenderer.js";
export { createOceanPlane } from "./oceanRenderer.js";
export { createMinimap } from "./minimap.js";
export { createDebugOverlay } from "./debugOverlay.js";

export type { PyramidMeshHandle, PyramidMeshOptions } from "./pyramidMesh.js";
export type { PyramidTerrainHandle, PyramidBootstrapOptions } from "./pyramidBootstrap.js";
export type { RiverChunkHandle, RiverLoaderOptions } from "./riverRenderer.js";
export type {
  PyramidManifest,
  PyramidTierMeta,
  TierName,
  LoadedChunk,
  RiverPolyline,
  RiverChunkData,
  RiverManifest,
  RiverManifestEntry
} from "./pyramidTypes.js";
