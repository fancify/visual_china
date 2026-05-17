import { Color } from "three";

export const RIVER_WATER_COLOR = new Color(0x557b82);
export const RIVER_WATER_OPACITY = 0.68;
// shimmer 0.08 → 0.20: ribbon shader 在 ribbon 中心区叠加 highlight 高光,
// 量太低则白天在草地上几乎看不见. 测试不约束此值绝对量, 仅 river < lake opacity.
export const RIVER_WATER_SHIMMER = 0.20;

export const LAKE_WATER_COLOR = new Color(0x6da0a6);
export const LAKE_WATER_OPACITY = 0.76;
export const LAKE_WATER_SHIMMER = 0.14;

export const OCEAN_WATER_COLOR = new Color(0x4f8fa0);
export const OCEAN_WATER_OPACITY = 0.88;
export const OCEAN_WATER_SHIMMER = 0.16;

export const WATER_SURFACE_COLOR = LAKE_WATER_COLOR;
export const WATER_SURFACE_OPACITY = LAKE_WATER_OPACITY;
