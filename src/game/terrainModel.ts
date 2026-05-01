import { Color, MathUtils } from "three";

import { TerrainSampler } from "./demSampler";
import type { EnvironmentState, EnvironmentVisuals } from "./environment";

function normalizedHeight(height: number, sampler: TerrainSampler): number {
  return MathUtils.clamp(
    (height - sampler.asset.minHeight) /
      (sampler.asset.maxHeight - sampler.asset.minHeight || 1),
    0,
    1
  );
}

export function zoneNameAt(x: number, z: number, sampler: TerrainSampler): string {
  const height = sampler.sampleHeight(x, z);

  if (z > 92) {
    return "黄土台塬";
  }

  if (z > 48 && height < 8) {
    return "关中平原";
  }

  if (z > -4) {
    return "秦岭山口带";
  }

  if (z > -44 && height < 10) {
    return "汉中盆地";
  }

  if (z > -88) {
    return "南山谷道";
  }

  if (height < 8) {
    return "成都平原";
  }

  return "盆地边缘";
}

export function modeColor(
  mode: "terrain" | "livelihood" | "war" | "military",
  x: number,
  z: number,
  height: number,
  sampler: TerrainSampler,
  environmentState: EnvironmentState,
  environmentVisuals: EnvironmentVisuals
): Color {
  const h = normalizedHeight(height, sampler);
  const slope = sampler.sampleSlope(x, z);
  const river = sampler.sampleRiver(x, z);
  const pass = sampler.samplePass(x, z);
  const settle = sampler.sampleSettlement(x, z);

  let color: Color;

  if (mode === "terrain") {
    color = new Color().setHSL(
      MathUtils.lerp(0.15, 0.1, h),
      MathUtils.lerp(0.3, 0.42, h),
      MathUtils.lerp(0.24, 0.86, Math.pow(h, 1.15))
    );
  } else if (mode === "livelihood") {
    color = new Color().setHSL(
      MathUtils.lerp(0.09, 0.24, settle),
      MathUtils.lerp(0.18, 0.56, settle),
      MathUtils.lerp(0.24, 0.58, settle)
    );
  } else if (mode === "war") {
    const corridor = MathUtils.clamp(
      0.32 + river * 0.28 + pass * 0.42 + settle * 0.22 - slope * 0.48,
      0,
      1
    );
    color = new Color().setHSL(
      MathUtils.lerp(0.58, 0.03, corridor),
      MathUtils.lerp(0.26, 0.76, corridor),
      MathUtils.lerp(0.22, 0.54, corridor)
    );
  } else {
    const strategic = MathUtils.clamp(
      pass * 0.44 + settle * 0.28 + river * 0.18 + h * 0.18,
      0,
      1
    );
    color = new Color().setHSL(
      MathUtils.lerp(0.46, 0.08, strategic),
      MathUtils.lerp(0.22, 0.72, strategic),
      MathUtils.lerp(0.2, 0.62, strategic)
    );
  }

  const hsl = { h: 0, s: 0, l: 0 };
  color.getHSL(hsl);

  hsl.h = (hsl.h + environmentVisuals.terrainHueShift + 1) % 1;
  hsl.s = MathUtils.clamp(hsl.s * environmentVisuals.terrainSaturationMul, 0, 1);
  hsl.l = MathUtils.clamp(
    hsl.l * environmentVisuals.terrainLightnessMul +
      (environmentState.weather === "snow" ? (1 - slope) * 0.08 : 0),
    0,
    1
  );

  color.setHSL(hsl.h, hsl.s, hsl.l);

  if (mode === "terrain" && environmentState.season === "winter" && height > sampler.asset.minHeight + (sampler.asset.maxHeight - sampler.asset.minHeight) * 0.52) {
    color.lerp(new Color("#f5f7fb"), 0.22 + h * 0.25);
  }

  if (mode === "terrain" && environmentState.season === "autumn" && settle > 0.45) {
    color.lerp(new Color("#c89252"), 0.08);
  }

  return color;
}
