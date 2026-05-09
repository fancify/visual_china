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
  colorAttribute: BufferAttribute;
  sampler: TerrainSampler;
  scenery?: Group;
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
    positionAttribute.setY(index, sampler.sampleHeight(x, z));
  }

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
  configureChunkTerrainFrustum(mesh, geometry);

  return {
    mesh,
    geometry,
    positionAttribute,
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
