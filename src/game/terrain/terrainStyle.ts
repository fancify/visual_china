// terrainStyle.ts — 地形调色风格预设
//
// 四种风格：
//   qinglu  — 千里江山图 青绿山水（默认，当前已有）
//   ink     — 唐代水墨写意，低饱和 + 高对比
//   botw    — Breath of the Wild 暖调，金绿为主
//   lowpoly — 低多边形策略地图风（flat shading + 暖黄绿 + 深蓝海）
//
// pyramid-demo.ts 的 debug 面板可实时切换。
// 切换后需调 refreshVertexColors + 刷新 fog/background + 水体颜色。

import { Color } from "three";

export interface WaterPalette {
  riverColor: Color;
  riverOpacity: number;
  lakeColor: Color;
  lakeOpacity: number;
  oceanColor: Color;
  oceanOpacity: number;
}

export interface TerrainPalette {
  lowGreen: Color;
  midWarm: Color;
  highStone: Color;
  snow: Color;
  steep: Color;
  beach: Color;
  coastalCliff: Color;
  coastalGrass: Color;
  fogColor: Color;
  fogNear: number;
  fogFar: number;
  water: WaterPalette;
  /** lowpoly 风格自动开 flat shading */
  flatShading: boolean;
}

// ─── 默认水体（共用） ───────────────────────────────────────────
const defaultWater: WaterPalette = {
  riverColor: new Color(0x557b82),
  riverOpacity: 0.68,
  lakeColor: new Color(0x6da0a6),
  lakeOpacity: 0.76,
  oceanColor: new Color(0x4f8fa0),
  oceanOpacity: 0.88,
};

// ─── 千里江山图 青绿 ────────────────────────────────────────────
const qinglu: TerrainPalette = {
  lowGreen: new Color(0.43, 0.62, 0.34),
  midWarm: new Color(0.58, 0.62, 0.38),
  highStone: new Color(0.46, 0.50, 0.43),
  snow: new Color(0.94, 0.93, 0.88),
  steep: new Color(0.38, 0.40, 0.30),
  beach: new Color(0.83, 0.76, 0.60),
  coastalCliff: new Color(0.50, 0.46, 0.42),
  coastalGrass: new Color(0.42, 0.62, 0.40),
  fogColor: new Color(0xc7d5e3),
  fogNear: 360,
  fogFar: 1250,
  water: defaultWater,
  flatShading: false,
};

// ─── 唐代水墨 ─────────────────────────────────────────────────
const ink: TerrainPalette = {
  lowGreen: new Color(0.52, 0.52, 0.48),
  midWarm: new Color(0.44, 0.43, 0.40),
  highStone: new Color(0.32, 0.31, 0.30),
  snow: new Color(0.92, 0.90, 0.86),
  steep: new Color(0.22, 0.22, 0.20),
  beach: new Color(0.72, 0.68, 0.58),
  coastalCliff: new Color(0.36, 0.34, 0.32),
  coastalGrass: new Color(0.48, 0.50, 0.44),
  fogColor: new Color(0xe8e4dc),
  fogNear: 280,
  fogFar: 900,
  water: {
    riverColor: new Color(0x5a6b6e),   // 墨灰河
    riverOpacity: 0.55,
    lakeColor: new Color(0x6a7d80),
    lakeOpacity: 0.60,
    oceanColor: new Color(0x5a6e78),
    oceanOpacity: 0.75,
  },
  flatShading: false,
};

// ─── BotW 暖调 ──────────────────────────────────────────────────
const botw: TerrainPalette = {
  lowGreen: new Color(0.52, 0.68, 0.32),
  midWarm: new Color(0.68, 0.62, 0.36),
  highStone: new Color(0.55, 0.50, 0.40),
  snow: new Color(0.96, 0.95, 0.92),
  steep: new Color(0.42, 0.38, 0.28),
  beach: new Color(0.88, 0.80, 0.58),
  coastalCliff: new Color(0.54, 0.48, 0.38),
  coastalGrass: new Color(0.50, 0.66, 0.36),
  fogColor: new Color(0xd4e0eb),
  fogNear: 400,
  fogFar: 1400,
  water: defaultWater,
  flatShading: false,
};

// ─── Low-poly 策略地图 ──────────────────────────────────────────
// 参考：低多边形大陆俯瞰地图（暖黄绿平原、金褐山峰、深蓝海洋、青蓝河流）
const lowpoly: TerrainPalette = {
  lowGreen: new Color(0.58, 0.72, 0.38),    // 暖黄绿草原（比 qinglu 更亮更暖）
  midWarm: new Color(0.72, 0.66, 0.40),     // 金黄丘陵
  highStone: new Color(0.62, 0.52, 0.36),   // 赭金山岩
  snow: new Color(0.95, 0.94, 0.90),        // 暖白雪顶
  steep: new Color(0.50, 0.42, 0.30),       // 深褐陡坡
  beach: new Color(0.85, 0.78, 0.55),       // 金沙滩
  coastalCliff: new Color(0.65, 0.55, 0.40),// 沙岩断崖
  coastalGrass: new Color(0.55, 0.68, 0.38),// 海岸草甸
  fogColor: new Color(0xb8d4e8),            // 淡蓝天空雾
  fogNear: 300,
  fogFar: 1100,
  water: {
    riverColor: new Color(0x3ca8c8),         // 亮青蓝河（参考图高饱和河流）
    riverOpacity: 0.85,
    lakeColor: new Color(0x4a9ab8),          // 湖蓝
    lakeOpacity: 0.82,
    oceanColor: new Color(0x2a6a90),         // 深海蓝
    oceanOpacity: 0.92,
  },
  flatShading: true,
};

export const TERRAIN_STYLES = { qinglu, ink, botw, lowpoly } as const;
export type TerrainStyleName = keyof typeof TERRAIN_STYLES;

let _active: TerrainStyleName = "lowpoly";
let _palette: TerrainPalette = lowpoly;

export function getTerrainStyle(): TerrainStyleName {
  return _active;
}

export function getTerrainPalette(): TerrainPalette {
  return _palette;
}

export function setTerrainStyle(name: TerrainStyleName): TerrainPalette {
  _active = name;
  _palette = TERRAIN_STYLES[name];
  return _palette;
}
