export interface MovementInput {
  heading: number;
  forward: number;
  right: number;
}

export interface MovementVector {
  x: number;
  z: number;
}

export function cameraForwardVector(heading: number): MovementVector;

export function cameraRightVector(heading: number): MovementVector;

export function movementVectorFromInput(input: MovementInput): MovementVector;
