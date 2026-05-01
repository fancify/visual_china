import type { QinlingAtlasFeature } from "./qinlingAtlas.js";
import type { HydrographyFeature } from "./hydrographyModel.js";

export interface ImportedHydrographyAsset {
  features: HydrographyFeature[];
}

export function importedWaterDisplayPriority(feature: HydrographyFeature): number;

export function importedHydrographyFeatureToAtlasFeature(
  feature: HydrographyFeature
): QinlingAtlasFeature;

export function importedHydrographyAssetToAtlasFeatures(
  asset: ImportedHydrographyAsset
): QinlingAtlasFeature[];
