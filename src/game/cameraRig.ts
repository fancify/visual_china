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

export const qinlingCameraRig: ThirdPersonCameraRig = {
  initialHeading: Math.PI,
  initialElevation: 1.02,
  minElevation: 0.32,
  maxElevation: 1.18,
  initialDistance: 118,
  minDistance: 26,
  maxDistance: 170,
  lookAtHeight: 2.9,
  followLerp: 0.12
};
