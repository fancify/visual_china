// minElevation 改到 0：相机能拉到与玩家同高，仰角直接平视到地平线，
// 看到太阳/月亮/星空。再低就会让相机沉到玩家脚下、撞地形。
export const qinlingCameraRig = {
  initialHeading: 0,
  initialElevation: 1.02,
  minElevation: 0.0,
  maxElevation: 1.18,
  initialDistance: 118,
  minDistance: 26,
  maxDistance: 170,
  lookAtHeight: 2.9,
  followLerp: 0.12
};
