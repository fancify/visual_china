export interface PlayerAvatarPart {
  name: string;
}

export const woodHorseAvatarParts: PlayerAvatarPart[];

export interface AvatarMovementVector {
  x: number;
  z: number;
}

export function avatarHeadingForMovement(vector: AvatarMovementVector): number;

export interface WoodHorseLegPoseInput {
  timeSeconds: number;
  movementIntensity: number;
}

export type WoodHorseLegName =
  | "front-left-leg"
  | "front-right-leg"
  | "back-left-leg"
  | "back-right-leg";

export function woodHorseLegPose(
  input: WoodHorseLegPoseInput
): Record<WoodHorseLegName, number>;
