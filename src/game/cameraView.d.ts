export type CameraViewMode = "overview" | "follow";

export interface CameraViewPoint {
  x: number;
  y: number;
  z: number;
}

export interface CameraLookTargetInput {
  mode: CameraViewMode;
  player: CameraViewPoint;
  lookAtHeight: number;
}

export function cameraLookTargetForMode(
  input: CameraLookTargetInput
): CameraViewPoint;
