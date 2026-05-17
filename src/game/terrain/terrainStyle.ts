// terrainStyle.ts — 地形调色风格预设
//
// 三种风格：
//   qinglu  — 千里江山图 青绿山水（默认，当前已有）
//   ink     — 唐代水墨写意，低饱和 + 高对比
//   botw    — Breath of the Wild 暖调，金绿为主
//
// pyramid-demo.ts 的 debug 面板可实时切换。
// 切换后需调 refreshVertexColors + 刷新 fog/background。

import { Color } from "three";

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
}

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
};

// ─── 唐代水墨 ─────────────────────────────────────────────────
const ink: TerrainPalette = {
  lowGreen: new Color(0.52, 0.52, 0.48),    // 淡墨灰绿
  midWarm: new Color(0.44, 0.43, 0.40),     // 中墨
  highStone: new Color(0.32, 0.31, 0.30),   // 浓墨岩
  snow: new Color(0.92, 0.90, 0.86),        // 宣纸白
  steep: new Color(0.22, 0.22, 0.20),       // 焦墨
  beach: new Color(0.72, 0.68, 0.58),       // 淡赭
  coastalCliff: new Color(0.36, 0.34, 0.32),
  coastalGrass: new Color(0.48, 0.50, 0.44),
  fogColor: new Color(0xe8e4dc),            // 宣纸暖白雾
  fogNear: 280,
  fogFar: 900,                              // 更浓的雾 → 留白效果
};

// ─── BotW 暖调 ──────────────────────────────────────────────────
const botw: TerrainPalette = {
  lowGreen: new Color(0.52, 0.68, 0.32),    // 金绿草原
  midWarm: new Color(0.68, 0.62, 0.36),     // 暖金丘陵
  highStone: new Color(0.55, 0.50, 0.40),   // 赭石岩
  snow: new Color(0.96, 0.95, 0.92),        // 暖白雪
  steep: new Color(0.42, 0.38, 0.28),       // 暗赭陡坡
  beach: new Color(0.88, 0.80, 0.58),       // 亮沙金
  coastalCliff: new Color(0.54, 0.48, 0.38),
  coastalGrass: new Color(0.50, 0.66, 0.36),
  fogColor: new Color(0xd4e0eb),            // 淡蓝偏暖
  fogNear: 400,
  fogFar: 1400,
};

export const TERRAIN_STYLES = { qinglu, ink, botw } as const;
export type TerrainStyleName = keyof typeof TERRAIN_STYLES;

let _active: TerrainStyleName = "qinglu";
let _palette: TerrainPalette = qinglu;

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
