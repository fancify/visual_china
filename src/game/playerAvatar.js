export const woodHorseAvatarParts = [
  { name: "wooden-horse-body" },
  { name: "wooden-horse-head" },
  { name: "wooden-horse-neck" },
  { name: "wooden-horse-tail" },
  { name: "front-left-leg" },
  { name: "front-right-leg" },
  { name: "back-left-leg" },
  { name: "back-right-leg" },
  { name: "traveler-head" },
  { name: "traveler-cloak" },
  { name: "traveler-douli" },
  { name: "traveler-eye-left" },
  { name: "traveler-eye-right" }
];

export function avatarHeadingForMovement({ x, z }) {
  if (x === 0 && z === 0) {
    return 0;
  }

  const heading = Math.atan2(-z, x);
  return Object.is(heading, -0) ? 0 : heading;
}

export function woodHorseLegPose({ timeSeconds, movementIntensity }) {
  const intensity = Math.max(0, Math.min(1, movementIntensity));
  const swing = Math.sin(timeSeconds * 10.5) * 0.34 * intensity;

  return {
    "front-left-leg": 0.1 + swing,
    "front-right-leg": -0.1 - swing,
    "back-left-leg": -0.1 - swing,
    "back-right-leg": 0.1 + swing
  };
}
