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

export interface CameraPositionInput {
  mode: CameraViewMode;
  lookTarget: CameraViewPoint;
  heading: number;
  elevation: number;
  distance: number;
}

export interface EffectiveCameraHeadingInput {
  mode: CameraViewMode;
  heading: number;
}

export function cameraLookTargetForMode(
  input: CameraLookTargetInput
): CameraViewPoint;

export function cameraPositionForMode(
  input: CameraPositionInput
): CameraViewPoint;

export function effectiveCameraHeadingForMode(
  input: EffectiveCameraHeadingInput
): number;

export function overviewScreenAxes(): {
  right: { x: number; z: number };
  up: { x: number; z: number };
};
