import { Color } from "three";

/**
 * 长安三万里 split-toning 色彩分级——青绿山水审美：
 * - 阴影区域 (luminance < 0.4) 推冷青色
 * - 高光区域 (luminance > 0.6) 推暖金色
 * - 中调 (0.4..0.6) 不动，保留原始山地色
 *
 * 跟 LUT 比，math 算法可以 runtime 跟着 environmentVisuals 改色
 *（黄昏推暖、雨天推灰）。
 *
 * 跑在 OutputPass 之前——它操作 linear 色，不要在 sRGB 端做 split tone。
 */
export const ColorGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uShadowColor: { value: new Color(0x3c5a6a) }, // 偏冷青
    uHighlightColor: { value: new Color(0xe8c898) }, // 暖金
    uShadowStrength: { value: 0.18 },
    uHighlightStrength: { value: 0.14 },
    uContrast: { value: 1.06 },
    uSaturation: { value: 1.05 }
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform vec3 uShadowColor;
    uniform vec3 uHighlightColor;
    uniform float uShadowStrength;
    uniform float uHighlightStrength;
    uniform float uContrast;
    uniform float uSaturation;

    varying vec2 vUv;

    void main() {
      vec4 src = texture2D(tDiffuse, vUv);
      vec3 c = src.rgb;

      // 1. luminance（rec.709）
      float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));

      // 2. split-toning：阴影向 cool 拉，高光向 warm 拉
      float shadowMask = smoothstep(0.4, 0.0, lum);
      float highlightMask = smoothstep(0.6, 1.0, lum);
      c = mix(c, uShadowColor, shadowMask * uShadowStrength);
      c = mix(c, uHighlightColor, highlightMask * uHighlightStrength);

      // 3. 轻微对比度（围绕 0.5 中灰旋转）
      c = (c - 0.5) * uContrast + 0.5;

      // 4. 饱和度（向灰拉 / 推开）
      float gray = dot(c, vec3(0.2126, 0.7152, 0.0722));
      c = mix(vec3(gray), c, uSaturation);

      gl_FragColor = vec4(clamp(c, 0.0, 1.0), src.a);
    }
  `
};
