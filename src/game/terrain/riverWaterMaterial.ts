// riverWaterMaterial.ts —
//
// Ribbon-style 水面 shader, 替代旧 LineSegments2 fat line.
//
// 顶点 attributes:
//   position   (xyz)     — ribbon 顶点世界坐标 (sampler 已注入地形 Y)
//   uv         (xy)      — x∈[0,1] 横跨河面 (0 左岸, 1 右岸), y 沿河流向累计 (世界单位)
//
// Fragment 输出:
//   - 中心深、岸边浅 + alpha fade
//   - 两层 sin-FBM 模拟波纹 + 流向 UV scroll
//   - 时辰 / 季节 / 天气 由调用方写入 uBaseColor / uHighlight / uOpacity
//
// 设计取舍:
//   - 不做反射 (BotW 河也没真反射, 烤 cubemap 代价大)
//   - 不做折射 (河深度差 < 1m, 折射偏移肉眼难辨)
//   - 法线扰动用 UV 域 sin 叠加 (够便宜, 远看像 FBM)

import { Color, DoubleSide, ShaderMaterial, type IUniform } from "three";

import {
  RIVER_WATER_COLOR,
  RIVER_WATER_OPACITY,
  RIVER_WATER_SHIMMER
} from "./waterStyle.js";

export interface RiverWaterUniforms {
  [name: string]: IUniform<unknown>;
  uTime: IUniform<number>;
  uBaseColor: IUniform<Color>;
  uHighlightColor: IUniform<Color>;
  uOpacity: IUniform<number>;
  uShimmer: IUniform<number>;
  uFlowSpeed: IUniform<number>;
}

const VERTEX_SHADER = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const FRAGMENT_SHADER = /* glsl */ `
  precision highp float;

  uniform float uTime;
  uniform vec3  uBaseColor;
  uniform vec3  uHighlightColor;
  uniform float uOpacity;
  uniform float uShimmer;
  uniform float uFlowSpeed;

  varying vec2 vUv;

  void main() {
    // edge ∈ [0,1]: 0 中心, 1 岸边
    float edge = abs(vUv.x - 0.5) * 2.0;

    // 两层错位 sin, 模拟流动 + 涟漪. UV.y 是沿河累计长度 (世界单位), 不用归一化
    float t = uTime * uFlowSpeed;
    float w1 = sin(vUv.y * 1.6 - t * 1.2 + vUv.x * 3.0);
    float w2 = sin(vUv.y * 3.7 - t * 0.7 - vUv.x * 5.0 + 1.7);
    float shimmer = (w1 + w2) * 0.25 + 0.5; // [0,1]

    // 中心深, 岸边混亮色 (水的菲涅尔感: 浅水偏白, 深水偏蓝)
    float depthTint = 1.0 - edge * 0.55;
    vec3 color = mix(uHighlightColor, uBaseColor, depthTint);

    // shimmer 加亮 — 强度更大, 让水面在草地上有辨识度
    color += uHighlightColor * shimmer * uShimmer * 2.5;

    // 边缘 alpha fade: 中心宽不透明带 + 岸边 smooth fade
    // edge < 0.78: 全不透明 (uOpacity)
    // edge ∈ [0.78, 1.0]: smoothstep 到 0
    float alpha = uOpacity * smoothstep(1.0, 0.78, edge);

    gl_FragColor = vec4(color, alpha);
  }
`;

export interface RiverWaterMaterial extends ShaderMaterial {
  uniforms: RiverWaterUniforms;
}

export function createRiverWaterMaterial(): RiverWaterMaterial {
  const material = new ShaderMaterial({
    vertexShader: VERTEX_SHADER,
    fragmentShader: FRAGMENT_SHADER,
    uniforms: {
      uTime: { value: 0 },
      uBaseColor: { value: RIVER_WATER_COLOR.clone() },
      uHighlightColor: { value: new Color(0xb5d4d8) },
      uOpacity: { value: RIVER_WATER_OPACITY },
      uShimmer: { value: RIVER_WATER_SHIMMER },
      uFlowSpeed: { value: 0.6 }
    },
    transparent: true,
    depthWrite: false,
    side: DoubleSide
    // 不用 polygonOffset: L/R 顶点已分别采样自己位置的 terrain Y, 整条 ribbon
    // 跟地形贴合 (不再有"探出高岸"形成阶梯 facet 的现象). Y_BIAS=5mm 兜 z-fight.
  }) as unknown as RiverWaterMaterial;

  material.name = "river-water";
  return material;
}

export function updateRiverWaterTime(material: RiverWaterMaterial, time: number): void {
  material.uniforms.uTime.value = time;
}
