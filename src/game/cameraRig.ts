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

// minElevation 改到 0：相机能拉到与玩家同高，仰角直接平视到地平线，
// 看到太阳/月亮/星空。再低就会让相机沉到玩家脚下、撞地形。
//
// minDistance 14 → 7：用户反馈 F 还不够近，再往里压一档让肩后视角真正
// 贴在主人公身后；lookAtHeight 也压到 1.6 让镜头看 chest level。
export const qinlingCameraRig: ThirdPersonCameraRig = {
  initialHeading: 0,
  initialElevation: 1.02,
  minElevation: 0.0,
  maxElevation: 1.18,
  initialDistance: 118,
  minDistance: 7,
  maxDistance: 170,
  lookAtHeight: 1.6,
  followLerp: 0.12
};
