import type { DemAsset } from "./demSampler.js";
import type { HydrographyFeature, HydrographyPoint } from "./hydrographyModel.js";

export interface HydrographyDemValidationOptions {
  minRiverAffinity?: number;
  maxSlope?: number;
}

export interface HydrographyPointDemDiagnostics {
  pointIndex?: number;
  x: number;
  y: number;
  height: number;
  riverAffinity: number;
  slope: number;
  missingTileNames: string[];
  issues: Array<"low-river-affinity" | "steep-dem-slope" | "interpolated-dem-tile">;
}

export interface HydrographyFeatureDemDiagnostics {
  featureId: string;
  name: string;
  rank: number;
  pointCount: number;
  problemPoints: number;
  points: HydrographyPointDemDiagnostics[];
}

export interface HydrographyDemValidationReport {
  schema: "visual-china.hydrography-dem-validation.v1";
  summary: {
    featureCount: number;
    totalPoints: number;
    problemPoints: number;
    issueCounts: Partial<Record<HydrographyPointDemDiagnostics["issues"][number], number>>;
  };
  features: HydrographyFeatureDemDiagnostics[];
}

export function hydrographyPointDemDiagnostics(
  point: HydrographyPoint,
  demAsset: Pick<DemAsset, "bounds" | "world" | "grid" | "heights" | "riverMask" | "notes">,
  options?: HydrographyDemValidationOptions
): HydrographyPointDemDiagnostics;

export function validateHydrographyAgainstDem(
  features: Pick<HydrographyFeature, "id" | "name" | "rank" | "geometry">[],
  demAsset: Pick<DemAsset, "bounds" | "world" | "grid" | "heights" | "riverMask" | "notes">,
  options?: HydrographyDemValidationOptions
): HydrographyDemValidationReport;
