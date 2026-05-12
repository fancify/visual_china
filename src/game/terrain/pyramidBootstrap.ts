// terrain/pyramidBootstrap.ts —
//
// 一站式入口：让 main.ts feature flag 切到新 pyramid renderer 时只调一行：
//
//   const { surfaceProvider, render } = await bootstrapPyramidTerrain(scene, opts);
//
// 内部:
//   1. 加载 manifest
//   2. 起 PyramidLoader / Sampler
//   3. 建 PyramidSurfaceProvider (实现旧接口)
//   4. 返回 render() function — 每帧 camera 改变时调
//
// 不替换旧 renderer——是 plug-in。旧 SurfaceProvider 接口零改动。

import type { Scene, PerspectiveCamera } from "three";
import { MeshPhongMaterial } from "three";
import { PyramidLoader } from "./pyramidLoader.js";
import { PyramidSampler } from "./pyramidSampler.js";
import { PyramidSurfaceProvider } from "./pyramidSurfaceProvider.js";
import { createPyramidChunkMesh, disposePyramidChunkMesh } from "./pyramidMesh.js";
import type { TierName } from "./pyramidTypes.js";
import { projectGeoToWorld } from "../mapOrientation.js";
import { qinlingRegionBounds, qinlingRegionWorld } from "../../data/qinlingRegion.js";

export interface PyramidTerrainHandle {
  loader: PyramidLoader;
  sampler: PyramidSampler;
  surfaceProvider: PyramidSurfaceProvider;
  /** 每帧 / camera 变动时调；async chunks 自加载 */
  updateVisible(camera: PerspectiveCamera, scene: Scene): void;
  dispose(): void;
}

export interface PyramidBootstrapOptions {
  baseUrl?: string;
  /** 视野半径（世界单位）。默认 100u (~330km) */
  viewRadiusUnits?: number;
  /** 共享 material；不传则默认 */
  material?: MeshPhongMaterial;
}

export async function bootstrapPyramidTerrain(
  scene: Scene,
  opts: PyramidBootstrapOptions = {}
): Promise<PyramidTerrainHandle> {
  const loader = new PyramidLoader({ baseUrl: opts.baseUrl ?? "/data/dem" });
  const manifest = await loader.loadManifest();
  const sampler = new PyramidSampler({ loader });
  sampler.setManifest(manifest);

  const surfaceProvider = new PyramidSurfaceProvider({ sampler });

  // mesh tracking: chunkKey → handle
  const meshHandles = new Map<string, ReturnType<typeof createPyramidChunkMesh>>();
  const material = opts.material ?? new MeshPhongMaterial({
    vertexColors: true,
    flatShading: false,
    shininess: 6
  });
  const viewRadius = opts.viewRadiusUnits ?? 100;

  function key(tier: TierName, x: number, z: number): string {
    return `${tier}:${x}:${z}`;
  }

  function updateVisible(camera: PerspectiveCamera, scene_: Scene): void {
    // Convert camera world XZ to lon/lat to decide which chunks are near
    const camX = camera.position.x;
    const camZ = camera.position.z;

    // For each tier, request chunks within view radius
    // L0 small radius, higher tiers progressively bigger
    const tierViewRadii: Record<TierName, number> = {
      L0: viewRadius * 0.3,
      L1: viewRadius * 0.6,
      L2: viewRadius,
      L3: viewRadius * 2,
      L4: viewRadius * 4
    };

    const desiredKeys = new Set<string>();
    for (const tierName of ["L0", "L1", "L2", "L3"] as TierName[]) {
      const tierMeta = manifest.tiers[tierName];
      if (!tierMeta) continue;
      const sizeDeg = tierMeta.chunkSizeDeg;
      // Approximate world unit per chunk: assume 1 deg ≈ 27.6 world units (project convention)
      const chunkWorldSize = sizeDeg * 27.6;
      const radius = tierViewRadii[tierName];
      const chunkRadius = Math.ceil(radius / chunkWorldSize);

      // Compute current camera chunk (rough)
      // Use unproject to get geo, then convert to chunk index
      // Simpler: iterate near chunks via meta range
      const [xMin, xMax] = tierMeta.chunkRangeX;
      const [zMin, zMax] = tierMeta.chunkRangeZ;
      // For each candidate chunk in tier, compute world distance from camera
      for (let x = xMin; x <= xMax; x += 1) {
        for (let z = zMin; z <= zMax; z += 1) {
          // chunk center geo
          const cLon = manifest.bounds.west + (x + 0.5) * sizeDeg;
          const cLat = manifest.bounds.north - (z + 0.5) * sizeDeg;
          const cWorld = projectGeoToWorld(
            { lat: cLat, lon: cLon },
            qinlingRegionBounds,
            qinlingRegionWorld
          );
          const dx = cWorld.x - camX;
          const dz = cWorld.z - camZ;
          const distSq = dx * dx + dz * dz;
          if (distSq <= radius * radius) {
            desiredKeys.add(key(tierName, x, z));
          }
        }
      }
    }

    // Request all desired chunks
    for (const k of desiredKeys) {
      if (meshHandles.has(k)) continue;
      const [tier, xs, zs] = k.split(":");
      void loader.requestChunk(tier as TierName, Number(xs), Number(zs)).then((chunk) => {
        if (!chunk) return;
        if (meshHandles.has(k)) return; // race
        const handle = createPyramidChunkMesh(chunk, { material });
        scene_.add(handle.mesh);
        meshHandles.set(k, handle);
      });
    }

    // Evict meshes outside desired set
    for (const [k, handle] of Array.from(meshHandles.entries())) {
      if (!desiredKeys.has(k)) {
        scene_.remove(handle.mesh);
        disposePyramidChunkMesh(handle);
        meshHandles.delete(k);
      }
    }
  }

  function dispose(): void {
    for (const [, handle] of meshHandles) {
      scene.remove(handle.mesh);
      disposePyramidChunkMesh(handle);
    }
    meshHandles.clear();
    material.dispose();
  }

  return { loader, sampler, surfaceProvider, updateVisible, dispose };
}
