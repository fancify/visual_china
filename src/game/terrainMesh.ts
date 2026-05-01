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
import { modeColor } from "./terrainModel";

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

  const mesh = new Mesh(
    geometry,
    new MeshPhongMaterial({
      vertexColors: true,
      flatShading: true,
      shininess: 8
    })
  );

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
