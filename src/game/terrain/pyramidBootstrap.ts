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
    // Mutually exclusive tier 选择：每个 L0 chunk grid location 只画一个 tier.
    // L0 在 chunk grid 上是最细粒度；其他 tier 都是 L0 的 2^n 聚合.
    //
    // 算法:
    //   1. 遍历 L0 grid 所有 chunk 位置
    //   2. 计算 chunk 到 camera 距离 → 选 tier (near=L0, mid=L1, far=L2, horizon=L3)
    //   3. 把对应 tier 的 chunk 加入 desiredKeys
    //   4. 同一个 L0 grid 位置永远只有一个 tier 在场 — **不重叠**
    const camX = camera.position.x;
    const camZ = camera.position.z;

    const desiredKeys = new Set<string>();
    const L0Meta = manifest.tiers.L0;
    if (!L0Meta) return;
    const L0SizeDeg = L0Meta.chunkSizeDeg;
    const [xMin, xMax] = L0Meta.chunkRangeX;
    const [zMin, zMax] = L0Meta.chunkRangeZ;

    // 距离阈值（世界单位）— 决定 tier 切换
    // L0 视野半径 = viewRadius；超出转 L1, 再外 L2, 再外 L3, 再外丢弃
    const tier1Dist = viewRadius * 1.0; // L0 → L1 边界
    const tier2Dist = viewRadius * 2.5; // L1 → L2 边界
    const tier3Dist = viewRadius * 6.0; // L2 → L3 边界

    for (let x = xMin; x <= xMax; x += 1) {
      for (let z = zMin; z <= zMax; z += 1) {
        // chunk center geo
        const cLon = manifest.bounds.west + (x + 0.5) * L0SizeDeg;
        const cLat = manifest.bounds.north - (z + 0.5) * L0SizeDeg;
        const cWorld = projectGeoToWorld(
          { lat: cLat, lon: cLon },
          qinlingRegionBounds,
          qinlingRegionWorld
        );
        const dx = cWorld.x - camX;
        const dz = cWorld.z - camZ;
        const dist = Math.sqrt(dx * dx + dz * dz);

        // pick base tier by distance, with fallback if missing
        // L0 hole? → 试 L1; L1 hole? → 试 L2; ...
        const tryTiers: [TierName, number][] = [];
        if (dist < tier1Dist) {
          tryTiers.push(["L0", 1], ["L1", 2], ["L2", 4], ["L3", 8]);
        } else if (dist < tier2Dist) {
          tryTiers.push(["L1", 2], ["L2", 4], ["L3", 8]);
        } else if (dist < tier3Dist) {
          tryTiers.push(["L2", 4], ["L3", 8]);
        } else {
          tryTiers.push(["L3", 8]);
        }
        for (const [tn, div] of tryTiers) {
          const cx = Math.floor(x / div);
          const cz = Math.floor(z / div);
          if (loader.isKnownMissing(tn, cx, cz)) continue;
          desiredKeys.add(key(tn, cx, cz));
          break;
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
