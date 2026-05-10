import { Color, MathUtils } from "three";

import { TerrainSampler } from "./demSampler";
import type { EnvironmentState, EnvironmentVisuals } from "./environment";
import { applySeasonalAdjustment, biomeWeightsAt } from "./biomeZones";
import { unprojectWorldToGeo } from "./mapOrientation.js";

export function terrainHeightRange(sampler: TerrainSampler): {
  minHeight: number;
  maxHeight: number;
} {
  return {
    minHeight: sampler.asset.presentation?.globalMinHeight ?? sampler.asset.minHeight,
    maxHeight: sampler.asset.presentation?.globalMaxHeight ?? sampler.asset.maxHeight
  };
}

export function terrainNormalizedHeight(height: number, sampler: TerrainSampler): number {
  const { minHeight, maxHeight } = terrainHeightRange(sampler);

  return MathUtils.clamp(
    (height - minHeight) /
      (maxHeight - minHeight || 1),
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

export function terrainVegetationCover({
  normalizedHeight,
  slope,
  river,
  settlement
}: {
  normalizedHeight: number;
  slope: number;
  river: number;
  settlement: number;
}): {
  agriculture: number;
  riparian: number;
  forest: number;
} {
  const lowland = MathUtils.clamp(1 - normalizedHeight / 0.42, 0, 1);
  const gentle = MathUtils.clamp(1 - slope / 0.72, 0, 1);
  const forestBand =
    MathUtils.clamp(1 - Math.abs(normalizedHeight - 0.48) / 0.36, 0, 1) *
    MathUtils.clamp(1 - slope / 0.92, 0, 1);

  return {
    agriculture: lowland * gentle * MathUtils.clamp(0.28 + settlement * 0.55, 0, 1),
    riparian: MathUtils.clamp(river * 0.72 + lowland * gentle * 0.18, 0, 1),
    forest: forestBand * MathUtils.clamp(0.35 + river * 0.18, 0, 1)
  };
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
  const h = terrainNormalizedHeight(height, sampler);
  const slope = sampler.sampleSlope(x, z);
  const river = sampler.sampleRiver(x, z);
  const pass = sampler.samplePass(x, z);
  const settle = sampler.sampleSettlement(x, z);
  const bounds = sampler.asset.bounds;
  const biome =
    bounds
      ? applySeasonalAdjustment(
          biomeWeightsAt(unprojectWorldToGeo({ x, z }, bounds, sampler.asset.world)),
          environmentVisuals.seasonalBlend
        )
      : null;

  let color: Color;

  if (mode === "terrain") {
    // 现在的地貌配色是双轴：height-band × climate-zone。
    // 先按 normalized elevation + slope 算山地带，再叠加秦岭南北气候带调制。
    // river / settlement tint 仍放在后面，优先级高于 biome modulation。
    //
    // Height-band zonation by normalized elevation + slope，参照秦岭/中国
    // 实际植被分布（不是臆想）：
    //   < 0.18 = 盆地 / 农田带（黄绿）
    //   0.18-0.45 = 暖温带阔叶混交林（中绿）
    //   0.45-0.75 = 温带针叶林（深绿）
    //   0.75-0.92 = 亚高山针叶 / 灌丛（灰绿偏蓝）
    //   > 0.92 = 高山草甸 / 裸岩（灰白）
    // 陡坡推向裸岩色（灰），沿河推向湿润亮绿。
    // 旧版 hue 0.15→0.10（黄色调）+ 弱植被 overlay 只能盖住 20-32%，
    // 出来整体土黄沙漠感，是用户反馈的根因。
    // Band 间端点必须连续 —— 否则在 h=0.18/0.45/0.75/0.92 处会出现一道
    // 暗色等高环（codex b65e2d0 review 抓到）。
    let hue, sat, lum;
    if (h < 0.18) {
      hue = 0.22;
      sat = 0.40;
      lum = MathUtils.lerp(0.46, 0.52, h / 0.18);
    } else if (h < 0.45) {
      const t = (h - 0.18) / 0.27;
      hue = MathUtils.lerp(0.22, 0.30, t);
      sat = MathUtils.lerp(0.40, 0.42, t);
      lum = MathUtils.lerp(0.52, 0.34, t);
    } else if (h < 0.62) {
      const t = (h - 0.45) / 0.17;
      hue = MathUtils.lerp(0.30, 0.32, t);
      sat = MathUtils.lerp(0.42, 0.36, t);
      lum = MathUtils.lerp(0.34, 0.40, t);
    } else if (h < 0.78) {
      const t = (h - 0.62) / 0.16;
      hue = 0.32;
      sat = MathUtils.lerp(0.36, 0.20, t);
      lum = MathUtils.lerp(0.40, 0.62, t);
    } else {
      // 用户："青藏高原也没雪山了，得有"。
      // exag 从 3.2 降到 1.07 后 normalized height 不再被夸张拉满，原雪线
      // 0.92 让 Tibet (raw ~10/17 ≈ 0.79) 落不进雪带。把雪线下移到 0.78，
      // Tibet plateau / 喜马拉雅 / 天山高峰都能上雪。
      const t = MathUtils.clamp((h - 0.78) / 0.22, 0, 1);
      hue = MathUtils.lerp(0.32, 0.08, t);
      sat = MathUtils.lerp(0.20, 0.06, t);
      lum = MathUtils.lerp(0.62, 0.84, t);
    }

    // 陡坡（slope > 0.45）向裸岩灰色推：暴露岩面在阴影面看是冷灰，
    // 阳面偏暖灰。简单起见取一个折中 hue。
    const rockiness = MathUtils.clamp((slope - 0.45) / 0.4, 0, 1);
    hue = MathUtils.lerp(hue, 0.07, rockiness * 0.55);
    sat = MathUtils.lerp(sat, 0.10, rockiness * 0.5);
    lum = MathUtils.lerp(lum, lum * 0.92, rockiness * 0.25);

    if (biome) {
      hue = MathUtils.euclideanModulo(hue + biome.hueShift, 1);
      sat = MathUtils.clamp(sat * biome.satScale, 0, 1);
      lum = MathUtils.clamp(lum * biome.lumScale, 0, 1);
    }

    color = new Color().setHSL(hue, sat, lum);

    // 用户："河水就在应该有水的地方染色，宽度尽可能贴近河水实际宽度"。
    // 重新启用 mesh vertex 染河——用 riverMask 直接 tint 蓝色，依赖 chunks
    // 的 1.8 km/cell + GPU 三角形内插得到 "1-2 km 宽河带"。
    //
    // L1 base 14 km/cell 太粗，染出来会是 14 km 宽 blob——按 cell 尺寸 gate：
    // cellSpan > 1.5 game unit (≈ 5 km) 跳过染色（远景看不见水，OK）；
    // chunks 的 cell ~0.55 unit (≈ 1.8 km) 远小于阈值 → 染色。
    const cellSpan =
      sampler.asset.world.width / Math.max(1, sampler.asset.grid.columns);
    if (cellSpan < 1.5 && river > 0.25) {
      // 染色强度：river ∈ [0.25, 1] 映射到 mix 因子 [0.35, 0.92]。
      // 0.92 让深水段几乎纯蓝（仍保留一点底色透出，避免过于荧光）。
      const intensity = MathUtils.clamp((river - 0.25) / 0.75, 0, 1);
      const waterColor = new Color().setHSL(0.58, 0.45, 0.46);
      color.lerp(waterColor, MathUtils.lerp(0.35, 0.92, intensity));
    }

    // 聚落附近向耕地黄绿推（农田 + 灌丛 mix）。Gate by slope —— 真正的
    // 农田只长在缓坡，陡坡上即使 settlementMask 高也不应该被涂成农田色
    // （否则盆地壁、悬崖会反过来从裸岩被拉回黄绿，codex b65e2d0 抓到）。
    if (settle > 0.5 && h < 0.35) {
      const gentle = MathUtils.clamp(1 - slope / 0.55, 0, 1);
      const agricultureTint = new Color().setHSL(0.20, 0.42, 0.50);
      color.lerp(agricultureTint, (settle - 0.5) * 0.4 * gentle);
    }
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

  // 注意：terrainHueShift/SaturationMul/LightnessMul 这三个之前在这里
  // setHSL 重染——已迁移到 terrain shader 的 fragment pass（updateTerrainShaderHsl
  // 每帧推 uniform）。这一段每顶点 HSL 计算去掉后，时间流逝不再触发任何
  // JS 重染，~440ms hitch 完全消失。
  // 雪天的 lightness 加成（高坡地积雪）跟 vertex slope 强相关，无法用统一
  // shader uniform 表达——保留在 JS 这层，由 weather 切换触发 recolor（罕见）。
  if (environmentState.weather === "snow") {
    const hsl = { h: 0, s: 0, l: 0 };
    color.getHSL(hsl);
    hsl.l = MathUtils.clamp(hsl.l + (1 - slope) * 0.08, 0, 1);
    color.setHSL(hsl.h, hsl.s, hsl.l);
  }

  const winterWeight = environmentVisuals.seasonalBlend.winter;
  if (mode === "terrain" && winterWeight > 0.05) {
    const snowAmount = MathUtils.smoothstep(h, 0.6, 0.95) * winterWeight;
    if (snowAmount > 0) {
      color.lerp(new Color(0xfafafa), snowAmount * 0.7);
    }
  }

  const autumnWeight = environmentVisuals.seasonalBlend.autumn;
  if (mode === "terrain" && autumnWeight > 0.05 && settle > 0.45) {
    color.lerp(new Color("#c89252"), 0.08 * autumnWeight);
  }

  return color;
}
