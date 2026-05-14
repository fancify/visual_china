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
import {
  createPyramidChunkMesh,
  disposePyramidChunkMesh,
  harmonizeBoundaryNormals,
  harmonizeCorner,
  refreshVertexColors
} from "./pyramidMesh.js";
import type { TierName } from "./pyramidTypes.js";
import type { LandMaskSampler } from "./landMaskRenderer.js";
import { clampCoastalTargetTier } from "./coastalLod.js";
import { projectGeoToWorld } from "../mapOrientation.js";
import { qinlingRegionBounds, qinlingRegionWorld } from "../../data/qinlingRegion.js";

export interface PyramidTerrainHandle {
  loader: PyramidLoader;
  sampler: PyramidSampler;
  surfaceProvider: PyramidSurfaceProvider;
  /** 每帧 / camera 变动时调；async chunks 自加载 */
  updateVisible(camera: PerspectiveCamera, scene: Scene): void;
  /** Debug: 切 L0-L3 tier 染色 (L0 绿/L1 蓝/L2 黄/L3 红) — 鸟瞰一眼看 tier 分布 */
  setDebugLodTint(active: boolean): void;
  /** Debug: 切 flatShading — 三角面分明 vs smooth blend */
  setFlatShading(active: boolean): void;
  /** Visual compare: toggle subtle flat-shore beach tint. */
  setBeachTint(active: boolean): void;
  /** 设置 LOD 距离 band (world units). 3 个数字: L0/L1, L1/L2, L2/L3 边界. 下一帧生效 */
  setLodBands(bands: [number, number, number]): void;
  /** 读当前 LOD 距离 band (world units) — 3 元组 */
  getLodBands(): [number, number, number];
  dispose(): void;
}

export interface PyramidBootstrapOptions {
  baseUrl?: string;
  /** 视野半径（世界单位）。默认 100u (~330km) */
  viewRadiusUnits?: number;
  /** 共享 material；不传则默认 */
  material?: MeshPhongMaterial;
  /** Optional vector coastline mask. DEM vertices outside land are hole-punched. */
  landMaskSampler?: LandMaskSampler | null;
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
  // Tier-tint debug materials — 鸟瞰看哪个 chunk 是哪 tier (D 键切换)
  const tierTintMaterials: Record<string, MeshPhongMaterial> = {
    L0: new MeshPhongMaterial({ color: 0x60c060, flatShading: false, shininess: 6 }),  // 绿 = 近景高细节
    L1: new MeshPhongMaterial({ color: 0x60a0d0, flatShading: false, shininess: 6 }),  // 蓝 = 中景
    L2: new MeshPhongMaterial({ color: 0xe0c050, flatShading: false, shininess: 6 }),  // 黄 = 远景
    L3: new MeshPhongMaterial({ color: 0xd06040, flatShading: false, shininess: 6 })   // 红 = 极远 horizon
  };
  let debugTintActive = false;
  let beachTintActive = true;
  const viewRadius = opts.viewRadiusUnits ?? 100;

  // Distance-band LOD (mutable — setLodBands() 改这个 array, 下帧 updateVisible 用):
  //   L0 (~434m cell)   0-150u    (~0-490km)  近景高细节
  //   L1 (~867m cell)   150-300u  (~490-980km) 中景
  //   L2 (~1734m cell)  300-600u  (~980-1968km) 远景
  //   L3 (~3469m cell)  600u+     (~1968km+) horizon
  // chunks 总数 ~308 (vs 旧 160/400/960 的 ~435, -29%), 三角形 ~-30%. 近场 0-490km 几
  // 乎一样, 中远场山形棱角变粗换性能.
  const lodBands: [number, number, number] = [150, 300, 600];

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

    // 每 L0 grid 位置选一 tier, Set dedup 自然合并多 L0 → 同 L1/L2/L3 chunk.
    // lodBands 是 mutable 外层闭包变量 — setLodBands() 改它, 下帧生效.
    const dBand = lodBands;

    // tier 解析: 按距离选 target tier, 不存在则 cascade 到 finer tier (codex P1 #1+2 修).
    // 直到找到一个 exists chunk 或所有 tier 都 missing. Manifest v2 用 chunks list 精确查;
    // v1 退到 range check.
    function resolveTier(x: number, z: number): { tier: TierName; cx: number; cz: number } | null {
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
      let targetIdx: number;
      if (dist < dBand[0]) targetIdx = 0;
      else if (dist < dBand[1]) targetIdx = 1;
      else if (dist < dBand[2]) targetIdx = 2;
      else targetIdx = 3;  // 远景永远 fallback 到 L3 (cascade 会找到 exists tier)
      targetIdx = clampCoastalTargetTier(
        targetIdx,
        x,
        z,
        L0SizeDeg,
        manifest.bounds,
        opts.landMaskSampler
      );

      // Cascade target → 0: 第一个 exists 的 tier 即用
      for (let t = targetIdx; t >= 0; t -= 1) {
        const tier = `L${t}` as TierName;
        const cx = x >> t;
        const cz = z >> t;
        const exists = loader.chunkExists(tier, cx, cz);
        if (exists === true) {
          return { tier, cx, cz };
        }
        if (exists === false) {
          continue; // manifest 明确没此 chunk, try finer
        }
        // exists === null: v1 manifest 无 chunks list, range check 兜底
        const meta = manifest.tiers[tier];
        if (!meta) continue;
        if (cx < meta.chunkRangeX[0] || cx > meta.chunkRangeX[1]) continue;
        if (cz < meta.chunkRangeZ[0] || cz > meta.chunkRangeZ[1]) continue;
        if (loader.isKnownMissing(tier, cx, cz)) continue;
        return { tier, cx, cz };
      }
      return null;
    }

    for (let x = xMin; x <= xMax; x += 1) {
      for (let z = zMin; z <= zMax; z += 1) {
        const sel = resolveTier(x, z);
        if (!sel) continue;
        desiredKeys.add(key(sel.tier, sel.cx, sel.cz));
      }
    }

    // Request all desired chunks
    for (const k of desiredKeys) {
      if (meshHandles.has(k)) continue;
      const [tier, xs, zs] = k.split(":");
      const x = Number(xs);
      const z = Number(zs);
      void loader.requestChunk(tier as TierName, x, z).then((chunk) => {
        if (!chunk) return;
        if (meshHandles.has(k)) return; // race
        const tierName = tier as TierName;
        const meshMaterial = debugTintActive ? tierTintMaterials[tierName] : material;
        const handle = createPyramidChunkMesh(chunk, {
          material: meshMaterial,
          landMaskSampler: opts.landMaskSampler,
          beachTintEnabled: beachTintActive
        });
        scene_.add(handle.mesh);
        meshHandles.set(k, handle);

        // 跨 chunk 法线统一 (tierName 已上面定义).

        // Step 1: 4 axis 邻居 edge harmonization
        const east = meshHandles.get(key(tierName, x + 1, z));
        if (east) harmonizeBoundaryNormals(handle, east, "east");
        const south = meshHandles.get(key(tierName, x, z + 1));
        if (south) harmonizeBoundaryNormals(handle, south, "south");
        const west = meshHandles.get(key(tierName, x - 1, z));
        if (west) harmonizeBoundaryNormals(west, handle, "east");
        const north = meshHandles.get(key(tierName, x, z - 1));
        if (north) harmonizeBoundaryNormals(north, handle, "south");

        // Step 2: 4 corner 4-way harmonization
        // 每角点收集所有已加载的共享 chunk + 对应 corner label
        const nw = meshHandles.get(key(tierName, x - 1, z - 1));
        const ne = meshHandles.get(key(tierName, x + 1, z - 1));
        const sw = meshHandles.get(key(tierName, x - 1, z + 1));
        const se = meshHandles.get(key(tierName, x + 1, z + 1));

        // 本 chunk NW corner = 西邻 NE = 北邻 SW = NW-diag SE
        const nwEntries: Parameters<typeof harmonizeCorner>[0] = [{ handle, corner: "NW" }];
        if (west) nwEntries.push({ handle: west, corner: "NE" });
        if (north) nwEntries.push({ handle: north, corner: "SW" });
        if (nw) nwEntries.push({ handle: nw, corner: "SE" });
        harmonizeCorner(nwEntries);

        // 本 chunk NE corner = 东邻 NW = 北邻 SE = NE-diag SW
        const neEntries: Parameters<typeof harmonizeCorner>[0] = [{ handle, corner: "NE" }];
        if (east) neEntries.push({ handle: east, corner: "NW" });
        if (north) neEntries.push({ handle: north, corner: "SE" });
        if (ne) neEntries.push({ handle: ne, corner: "SW" });
        harmonizeCorner(neEntries);

        // 本 chunk SW corner = 西邻 SE = 南邻 NW = SW-diag NE
        const swEntries: Parameters<typeof harmonizeCorner>[0] = [{ handle, corner: "SW" }];
        if (west) swEntries.push({ handle: west, corner: "SE" });
        if (south) swEntries.push({ handle: south, corner: "NW" });
        if (sw) swEntries.push({ handle: sw, corner: "NE" });
        harmonizeCorner(swEntries);

        // 本 chunk SE corner = 东邻 SW = 南邻 NE = SE-diag NW
        const seEntries: Parameters<typeof harmonizeCorner>[0] = [{ handle, corner: "SE" }];
        if (east) seEntries.push({ handle: east, corner: "SW" });
        if (south) seEntries.push({ handle: south, corner: "NE" });
        if (se) seEntries.push({ handle: se, corner: "NW" });
        harmonizeCorner(seEntries);
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
    for (const m of Object.values(tierTintMaterials)) m.dispose();
  }

  /** 切换 LOD 染色 debug — L0 绿 L1 蓝 L2 黄 L3 红, 鸟瞰一眼看清 tier 分布 */
  function setDebugLodTint(active: boolean): void {
    debugTintActive = active;
    for (const [k, handle] of meshHandles) {
      const tier = k.split(":")[0] as TierName;
      handle.mesh.material = active ? tierTintMaterials[tier] : material;
    }
  }

  /** 切 flatShading — 三角面边分明 vs smooth blend. 全 material 同步 toggle. */
  function setFlatShading(active: boolean): void {
    material.flatShading = active;
    material.needsUpdate = true;
    for (const m of Object.values(tierTintMaterials)) {
      m.flatShading = active;
      m.needsUpdate = true;
    }
  }

  function setBeachTint(active: boolean): void {
    beachTintActive = active;
    for (const [, handle] of meshHandles) {
      const base = handle.geometry.userData.coastProximityBase as Float32Array | undefined;
      const positionCount = handle.geometry.attributes.position.count;
      handle.geometry.userData.coastProximity = active && base
        ? base
        : new Float32Array(positionCount);
      refreshVertexColors(handle);
    }
  }

  /** 设 LOD 距离 band (world units) — mutate in-place 让 updateVisible 闭包看到新值 */
  function setLodBands(bands: [number, number, number]): void {
    lodBands[0] = bands[0];
    lodBands[1] = bands[1];
    lodBands[2] = bands[2];
  }

  function getLodBands(): [number, number, number] {
    return [lodBands[0], lodBands[1], lodBands[2]];
  }

  return {
    loader,
    sampler,
    surfaceProvider,
    updateVisible,
    setDebugLodTint,
    setFlatShading,
    setBeachTint,
    setLodBands,
    getLodBands,
    dispose
  };
}
