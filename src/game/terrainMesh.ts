import {
  BufferAttribute,
  Color,
  Group,
  Mesh,
  MeshPhongMaterial,
  PlaneGeometry
} from "three";

import type { ViewMode } from "../data/qinlingSlice";
import type { EnvironmentState, EnvironmentVisuals } from "./environment";
import { TerrainSampler } from "./demSampler";
import { configureChunkTerrainFrustum } from "./terrainMeshFrustum.js";
import { modeColor } from "./terrainModel";
import { attachTerrainShaderEnhancements } from "./terrainShaderEnhancer";

export interface TerrainMeshHandle {
  mesh: Mesh;
  geometry: PlaneGeometry;
  positionAttribute: BufferAttribute;
  positionLod0Attribute: BufferAttribute;
  positionLod1Attribute: BufferAttribute;
  colorAttribute: BufferAttribute;
  sampler: TerrainSampler;
  scenery?: Group;
}

// Deterministic micro-bump：让 flat shading 在平原（成都平原、华北平原等
// 地形几乎水平的区域）也露出三角划分。所有 vertex normal 一致 = 同色 = 看不出
// 三角；±0.025 单位（≈ ±5m）随机扰动让相邻三角 normal 轻微错位 → flat shading
// 颜色细微差 → "low-poly stylized" 三角格肉眼可辨。
//
// hash 必须 deterministic（chunk reload 时噪点不能 flicker）。基于 vertex
// local x/z 的 sin-hash 足够便宜且无视觉 tile artifact。
const MICRO_BUMP_AMPLITUDE = 0.025;
function microBump(localX: number, localZ: number): number {
  const seed = Math.sin(localX * 12.9898 + localZ * 78.233) * 43758.5453;
  const fract = seed - Math.floor(seed);
  return (fract - 0.5) * 2 * MICRO_BUMP_AMPLITUDE;
}

export function applyTerrainLodMorphAttributes(
  geometry: PlaneGeometry,
  sampler: TerrainSampler,
  positionAttribute: BufferAttribute
): {
  positionLod0Attribute: BufferAttribute;
  positionLod1Attribute: BufferAttribute;
} {
  const positionLod0Attribute = new BufferAttribute(
    new Float32Array(positionAttribute.count * 3),
    3
  );
  const positionLod1Attribute = new BufferAttribute(
    new Float32Array(positionAttribute.count * 3),
    3
  );
  const hasL1 = sampler.asset.lodHeights?.L1 !== undefined;

  for (let index = 0; index < positionAttribute.count; index += 1) {
    const x = positionAttribute.getX(index);
    const y = positionAttribute.getY(index);
    const z = positionAttribute.getZ(index);
    const lod1Y = hasL1 ? sampler.sampleHeightLod(x, z, 1) : y;

    positionLod0Attribute.setXYZ(index, x, y, z);
    positionLod1Attribute.setXYZ(index, x, lod1Y, z);
  }

  geometry.setAttribute("positionLod0", positionLod0Attribute);
  geometry.setAttribute("positionLod1", positionLod1Attribute);

  return { positionLod0Attribute, positionLod1Attribute };
}

export function createTerrainMesh(sampler: TerrainSampler): TerrainMeshHandle {
  const geometry = new PlaneGeometry(
    sampler.asset.world.width,
    sampler.asset.world.depth,
    Math.max(1, sampler.asset.grid.columns - 1),
    Math.max(1, sampler.asset.grid.rows - 1)
  );
  geometry.rotateX(-Math.PI / 2);

  const positionAttribute = geometry.attributes.position as BufferAttribute;

  for (let index = 0; index < positionAttribute.count; index += 1) {
    const x = positionAttribute.getX(index);
    const z = positionAttribute.getZ(index);
    positionAttribute.setY(index, sampler.sampleHeight(x, z) + microBump(x, z));
  }
  const { positionLod0Attribute, positionLod1Attribute } =
    applyTerrainLodMorphAttributes(geometry, sampler, positionAttribute);

  geometry.computeVertexNormals();

  const colorAttribute = new BufferAttribute(
    new Float32Array(positionAttribute.count * 3),
    3
  );
  geometry.setAttribute("color", colorAttribute);

  // transparent + opacity 默认 0 让 chunk 第一次出现时从透明 fade in，
  // 不会"嗒"地一下从全黑突然变成完整地形（codex c039a4b P1 抓到 chunk
  // 流式加载时 mesh.visible 切换是硬跳）。main.ts 维护 fade timer。
  const material = new MeshPhongMaterial({
    vertexColors: true,
    // 用户实验：切回 flatShading 看 low-poly 块状画风。性能差 < 1%，
    // 视觉决定。Smooth false → true 让每三角形清晰可辨，更"low-poly stylized"。
    flatShading: true,
    shininess: 8,
    transparent: true,
    opacity: 0
  });
  attachTerrainShaderEnhancements(material, {
    heightFogColor: new Color(0xb6c4be),
    // 跟主 terrainMaterial 同款远山初始色（千里江山图 石青）。每帧 main loop
    // 会 updateTerrainShaderAtmosphericFar 把它跟天色 mix 后写回。
    atmosphericFarColor: new Color(0x5f8ba6)
  });
  const mesh = new Mesh(geometry, material);
  // 方案 A：chunks 后绘，覆盖 base mesh。base 的 polygonOffset 推远 + 这里
  // renderOrder 抬高，双重确保 chunks 在重叠区域永远显示在 base 之上。
  mesh.renderOrder = 1;
  configureChunkTerrainFrustum(mesh, geometry);

  return {
    mesh,
    geometry,
    positionAttribute,
    positionLod0Attribute,
    positionLod1Attribute,
    colorAttribute,
    sampler
  };
}

export function setTerrainMeshWorldPosition(
  terrainMesh: TerrainMeshHandle,
  centerX: number,
  centerZ: number,
  yOffset = 0
): void {
  terrainMesh.mesh.position.set(centerX, yOffset, centerZ);
}

export function setTerrainMeshSurfaceVisible(
  terrainMesh: TerrainMeshHandle,
  visible: boolean
): void {
  if (Array.isArray(terrainMesh.mesh.material)) {
    terrainMesh.mesh.material.forEach((material) => {
      material.visible = visible;
    });
    return;
  }

  terrainMesh.mesh.material.visible = visible;
}

export function updateTerrainMeshColors(
  terrainMesh: TerrainMeshHandle,
  mode: ViewMode,
  environmentState: EnvironmentState,
  visuals: EnvironmentVisuals
): void {
  const color = new Color();

  for (let index = 0; index < terrainMesh.positionAttribute.count; index += 1) {
    const localX = terrainMesh.positionAttribute.getX(index);
    const localY = terrainMesh.positionAttribute.getY(index);
    const localZ = terrainMesh.positionAttribute.getZ(index);

    color.copy(
      modeColor(
        mode,
        localX,
        localZ,
        localY,
        terrainMesh.sampler,
        environmentState,
        visuals
      )
    );
    terrainMesh.colorAttribute.setXYZ(index, color.r, color.g, color.b);
  }

  terrainMesh.colorAttribute.needsUpdate = true;
}

export function disposeTerrainMesh(terrainMesh: TerrainMeshHandle): void {
  terrainMesh.mesh.clear();
  terrainMesh.geometry.dispose();

  if (Array.isArray(terrainMesh.mesh.material)) {
    terrainMesh.mesh.material.forEach((material) => material.dispose());
    return;
  }

  terrainMesh.mesh.material.dispose();
}
