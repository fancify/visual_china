// Line A authoring source for game-only POI presentation tweaks.
//
// Historical facts stay in Line B POI docs and the generated POI registry.
// This file may tune how a known POI is rendered in 3D, but it must not carry
// names, coordinates, historical summaries, or source metadata.

export type PoiAnchorPolicy = "terrain" | "surface" | "floating";
export type PoiVisibilityTier = "gravity" | "large" | "medium" | "small";

export interface PoiWorldOffset {
  x?: number;
  z?: number;
}

export interface PoiVisualOverride {
  modelId?: string;
  scale?: number;
  rotationY?: number;
  yOffset?: number;
  worldOffset?: PoiWorldOffset;
  visibilityTier?: PoiVisibilityTier;
  anchorPolicy?: PoiAnchorPolicy;
}

export const POI_VISUAL_OVERRIDES: Readonly<Record<string, PoiVisualOverride>> = {
} as const;
