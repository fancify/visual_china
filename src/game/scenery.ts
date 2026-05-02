import {
  ConeGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshPhongMaterial,
  Object3D
} from "three";

import { TerrainSampler } from "./demSampler";
import type { RuntimePerformanceBudget } from "./performanceBudget";

// 共享 geometry / material：scenery 在每个 chunk 加载时被频繁创建/卸载，
// 共享资源避免重复 GPU 上传和材质实例数膨胀。
const sharedTreeGeometry = new ConeGeometry(0.38, 1.75, 5);
const sharedTreeMaterial = new MeshPhongMaterial({
  color: 0x4f7f58,
  flatShading: true,
  shininess: 5
});

// settlement markers（5 棱柱褐色块）已移除：用户反馈"看不出含义"，
// 而且位置是 chunk 内伪随机，并不对应真实城镇。P4 城市存在感会换成
// 真实坐标的 instanced 建筑簇，这里先把误导性的几何体清掉。

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

export function createChunkScenery(
  sampler: TerrainSampler,
  budget: RuntimePerformanceBudget["scenery"]
): Group {
  const group = new Group();
  const dummy = new Object3D();

  const treeMatrices: Matrix4[] = [];
  const { width, depth } = sampler.asset.world;
  const columns = 12;
  const rows = 12;

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
      // sampleSettlement 也是合成出来的（高程 + 坡度 + 湿度），不对应真实
      // 城镇。一并不再用作"空树"过滤——否则盆地会出现大片明显空地暗示
      // 子虚乌有的聚落（codex 1af1fe7 review 抓到）。基本盆地实际历史上
      // 是农田 + 村落，长树合理。
      const forestBand = Math.max(0, 1 - Math.abs(h - 0.46) / 0.34);
      const lowlandGreen = Math.max(0, 1 - h / 0.44) * Math.max(0, 1 - slope / 0.72);
      const vegetationChance = 0.12 + river * 0.22 + forestBand * 0.24 + lowlandGreen * 0.16;

      if (
        treeMatrices.length < budget.maxTreesPerChunk &&
        h > 0.18 &&
        h < 0.78 &&
        slope < 0.62 &&
        pseudoRandom(seed + 31) < vegetationChance
      ) {
        const scale = 0.62 + pseudoRandom(seed + 43) * 0.55;
        dummy.position.set(x, height + 0.88 * scale, z);
        dummy.rotation.set(0, pseudoRandom(seed + 59) * Math.PI * 2, 0);
        dummy.scale.set(scale, scale, scale);
        dummy.updateMatrix();
        treeMatrices.push(dummy.matrix.clone());
      }
    }
  }

  const trees = new InstancedMesh(
    sharedTreeGeometry,
    sharedTreeMaterial,
    Math.max(1, treeMatrices.length)
  );
  trees.count = treeMatrices.length;
  treeMatrices.forEach((matrix, index) => trees.setMatrixAt(index, matrix));
  trees.instanceMatrix.needsUpdate = true;
  trees.userData.sharedResources = true;
  group.add(trees);

  return group;
}

export function disposeScenery(group: Group): void {
  // geometry / material 是模块级共享资源，不能 dispose；
  // InstancedMesh 自身的 instanceMatrix buffer 由 GC 回收。
  group.traverse((child) => {
    if (child instanceof InstancedMesh) {
      // 释放 instance 缓冲，避免 GPU 端孤儿 buffer 累积。
      child.dispose();
    } else if (child instanceof Mesh) {
      child.geometry.dispose();
      if (Array.isArray(child.material)) {
        child.material.forEach((entry) => entry.dispose());
      } else {
        child.material.dispose();
      }
    }
  });
}
