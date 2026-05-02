export interface ThirdPersonCameraRig {
  initialHeading: number;
  initialElevation: number;
  minElevation: number;
  maxElevation: number;
  initialDistance: number;
  minDistance: number;
  maxDistance: number;
  lookAtHeight: number;
  followLerp: number;
}

export const qinlingCameraRig: ThirdPersonCameraRig;
