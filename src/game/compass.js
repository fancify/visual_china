import { cameraForwardVector, cameraRightVector } from "./navigation.js";
import { MAP_NORTH } from "./mapOrientation.js";

const directionLabels = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
const fullTurn = Math.PI * 2;

function normalizeAngle(angle) {
  return ((angle % fullTurn) + fullTurn) % fullTurn;
}

export function northNeedleAngleRadians(cameraHeading) {
  const right = cameraRightVector(cameraHeading);
  const forward = cameraForwardVector(cameraHeading);
  const screenX = MAP_NORTH.x * right.x + MAP_NORTH.z * right.z;
  const screenYUp = MAP_NORTH.x * forward.x + MAP_NORTH.z * forward.z;

  return Math.atan2(screenX, screenYUp);
}

// 新 mapOrientation 契约：北 = -Z。
// 从 MAP_NORTH 顺时针计算 forward / right 的角度——sector 0=北、2=东、4=南、6=西。
function clockwiseFromNorth(vec) {
  // dot(vec, MAP_NORTH) = vec.x * 0 + vec.z * (-1) = -vec.z
  // cross(vec, MAP_NORTH 顺时针轴) = vec.x * 1 + vec.z * 0 = vec.x
  return Math.atan2(vec.x, -vec.z);
}

export function cameraDirectionLabel(cameraHeading) {
  const forward = cameraForwardVector(cameraHeading);
  const angleFromNorth = normalizeAngle(clockwiseFromNorth(forward));
  const sector = Math.round(angleFromNorth / (Math.PI / 4)) % directionLabels.length;

  return directionLabels[sector];
}

export function screenRightDirectionLabel(cameraHeading) {
  const right = cameraRightVector(cameraHeading);
  const angleFromNorth = normalizeAngle(clockwiseFromNorth(right));
  const sector = Math.round(angleFromNorth / (Math.PI / 4)) % directionLabels.length;

  return directionLabels[sector];
}
