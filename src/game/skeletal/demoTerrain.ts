import {
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry
} from "three";

/**
 * M1 spike — 自建 procedural 山地 + sampler 接口。**不动** Line A 的
 * src/game/terrain/ — 等 Line A 合 main 后，pyramid-demo 的 sampler 实现
 * 直接替换 createDemoTerrain 的 sampler，character runtime 不用改。
 *
 * sampleSurfaceHeight 与旧 avatarTilt.ts 中 `TerrainSurfaceSampler`
 * 接口一致，可以无缝复用 4-sample tilt 算法。
 */

export interface TerrainSurfaceSampler {
  sampleSurfaceHeight(x: number, z: number): number;
}

export interface DemoTerrain {
  mesh: Mesh;
  sampler: TerrainSurfaceSampler;
  /** 地图正方形边长（米）。character 应在 [-size/2, size/2] 内活动。 */
  size: number;
}

interface DemoTerrainOptions {
  size?: number;
  segments?: number;
  /** 地形材质 base color。默认深绿，BotW 风偏向青翠。 */
  color?: number;
}

/** 测试地形：出生点 (0,0) 周围一片平地，前方 (+X 方向) 有一座单一斜坡。
 *
 * 平地范围: x ∈ (-∞, RAMP_X_START], 高度 = 0
 * 斜坡:    x ∈ [RAMP_X_START, RAMP_X_END], smoothstep 平滑升高
 * 坡顶台地: x > RAMP_X_END, 保持 RAMP_HEIGHT
 *
 * z 方向用高斯衰减，让坡像一座局部小山而不是无限长的墙——离 z=0 越远坡越矮。
 */
const RAMP_X_START = 12;
const RAMP_X_END = 30;
const RAMP_HEIGHT = 6;
const RAMP_Z_SIGMA = 22;

function smoothstep01(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

function heightAt(x: number, z: number): number {
  if (x <= RAMP_X_START) return 0;
  const rampT = (x - RAMP_X_START) / (RAMP_X_END - RAMP_X_START);
  const upX = smoothstep01(rampT);
  const zFalloff = Math.exp(-(z * z) / (2 * RAMP_Z_SIGMA * RAMP_Z_SIGMA));
  return upX * RAMP_HEIGHT * zFalloff;
}

export function sampleDemoTerrainHeight(x: number, z: number): number {
  return heightAt(x, -z);
}

export function createDemoTerrain(options: DemoTerrainOptions = {}): DemoTerrain {
  const size = options.size ?? 120;
  const segments = options.segments ?? 96;
  const color = options.color ?? 0x4a6038;

  const geometry = new PlaneGeometry(size, size, segments, segments);
  // Plane 默认在 XY 平面（z = 0），下面会旋转 -π/2 让它躺在 XZ。
  // 在旋转之前，给每个顶点 z 方向（旋转后变成 world Y）添加 noise。
  const positions = geometry.attributes.position;
  if (!positions) {
    throw new Error("PlaneGeometry missing position attribute");
  }
  for (let i = 0; i < positions.count; i += 1) {
    const x = positions.getX(i);
    const y = positions.getY(i); // pre-rotation Y → post-rotation world Z
    positions.setZ(i, heightAt(x, y));
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();

  const material = new MeshStandardMaterial({
    color,
    roughness: 0.92,
    metalness: 0,
    flatShading: false
  });

  const mesh = new Mesh(geometry, material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  mesh.name = "demo-terrain";

  const sampler: TerrainSurfaceSampler = {
    sampleSurfaceHeight(x: number, z: number): number {
      // 旋转后 mesh 在 XZ 平面，但 noise 输入坐标与旋转前 plane 的 (x, y)
      // 一一对应（plane 旋转 -π/2 让原 +Y 映射到 -Z）。所以采样 (x, z)
      // 需传入 (x, -z) 才能匹配 mesh 上的顶点位置——不对，让我们重看：
      //
      // PlaneGeometry 旋转前: 顶点在 XY 平面，z = noise(x, y)
      // mesh.rotation.x = -π/2: 旋转 -90° around X 轴
      //   旋转矩阵把 (x, y, z) → (x, z, -y)
      //   旋转后顶点 world 位置: (x, noise(x,y), -y)
      //   即 world (X, Y, Z) = (x, noise(x,y), -y)
      //
      // 所以给 world (x, z)，对应原 plane 的 (x, y=-z)，高度 = noise(x, -z)
      return sampleDemoTerrainHeight(x, z);
    }
  };

  return { mesh, sampler, size };
}
