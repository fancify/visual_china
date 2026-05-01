import {
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhongMaterial,
  Object3D
} from "three";

import { TerrainSampler } from "./demSampler";
import type { RuntimePerformanceBudget } from "./performanceBudget";

function pseudoRandom(seed: number): number {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

function normalizedHeight(height: number, sampler: TerrainSampler): number {
  const minHeight = sampler.asset.presentation?.globalMinHeight ?? sampler.asset.minHeight;
  const maxHeight = sampler.asset.presentation?.globalMaxHeight ?? sampler.asset.maxHeight;

  return (
    (height - minHeight) /
    (maxHeight - minHeight || 1)
  );
}

function disposeMaterial(material: Mesh["material"]): void {
  if (Array.isArray(material)) {
    material.forEach((entry) => entry.dispose());
    return;
  }

  material.dispose();
}

export function createChunkScenery(
  sampler: TerrainSampler,
  budget: RuntimePerformanceBudget["scenery"]
): Group {
  const group = new Group();
  const dummy = new Object3D();
  const treeGeometry = new ConeGeometry(0.38, 1.75, 5);
  const treeMaterial = new MeshPhongMaterial({
    color: 0x4f7f58,
    flatShading: true,
    shininess: 5
  });
  const settlementGeometry = new CylinderGeometry(0.42, 0.58, 1.4, 5);
  const settlementMaterial = new MeshPhongMaterial({
    color: 0xb89b63,
    flatShading: true,
    shininess: 7
  });

  const treeMatrices: Matrix4[] = [];
  const settlementMatrices: Matrix4[] = [];
  const { width, depth } = sampler.asset.world;
  const columns = 9;
  const rows = 9;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const seed = row * columns + column + width * 13 + depth * 7;
      const jitterX = (pseudoRandom(seed) - 0.5) * (width / columns) * 0.8;
      const jitterZ = (pseudoRandom(seed + 17) - 0.5) * (depth / rows) * 0.8;
      const x = -width * 0.5 + ((column + 0.5) / columns) * width + jitterX;
      const z = -depth * 0.5 + ((row + 0.5) / rows) * depth + jitterZ;
      const height = sampler.sampleHeight(x, z);
      const h = normalizedHeight(height, sampler);
      const slope = sampler.sampleSlope(x, z);
      const river = sampler.sampleRiver(x, z);
      const settlement = sampler.sampleSettlement(x, z);

      if (
        treeMatrices.length < budget.maxTreesPerChunk &&
        h > 0.32 &&
        h < 0.74 &&
        slope < 0.5 &&
        settlement < 0.74 &&
        pseudoRandom(seed + 31) < 0.28 + river * 0.12
      ) {
        const scale = 0.62 + pseudoRandom(seed + 43) * 0.55;
        dummy.position.set(x, height + 0.88 * scale, z);
        dummy.rotation.set(0, pseudoRandom(seed + 59) * Math.PI * 2, 0);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        treeMatrices.push(dummy.matrix.clone());
      }

      if (
        settlementMatrices.length < budget.maxSettlementMarkersPerChunk &&
        settlement > 0.76 &&
        slope < 0.42 &&
        h < 0.58 &&
        pseudoRandom(seed + 71) < 0.32
      ) {
        const scale = 0.9 + pseudoRandom(seed + 83) * 0.65;
        dummy.position.set(x, height + 0.72 * scale, z);
        dummy.rotation.set(0, pseudoRandom(seed + 97) * Math.PI * 2, 0);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        settlementMatrices.push(dummy.matrix.clone());
      }
    }
  }

  const trees = new InstancedMesh(
    treeGeometry,
    treeMaterial,
    Math.max(1, treeMatrices.length)
  );
  trees.count = treeMatrices.length;
  treeMatrices.forEach((matrix, index) => trees.setMatrixAt(index, matrix));
  trees.instanceMatrix.needsUpdate = true;
  group.add(trees);

  const settlements = new InstancedMesh(
    settlementGeometry,
    settlementMaterial,
    Math.max(1, settlementMatrices.length)
  );
  settlements.count = settlementMatrices.length;
  settlementMatrices.forEach((matrix, index) => settlements.setMatrixAt(index, matrix));
  settlements.instanceMatrix.needsUpdate = true;
  group.add(settlements);

  return group;
}

export function disposeScenery(group: Group): void {
  group.traverse((child) => {
    if (child instanceof Mesh) {
      child.geometry.dispose();
      disposeMaterial(child.material);
    }
  });
}
