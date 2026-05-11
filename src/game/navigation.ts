export interface MovementInput {
  heading: number;
  forward: number;
  right: number;
}

export interface MovementVector {
  x: number;
  z: number;
}

function normalize2D(vector: MovementVector): MovementVector {
  const length = Math.hypot(vector.x, vector.z);

  if (length === 0) {
    return { x: 0, z: 0 };
  }

  return {
    x: vector.x / length,
    z: vector.z / length
  };
}

export function cameraForwardVector(heading: number): MovementVector {
  return normalize2D({
    x: -Math.sin(heading),
    z: -Math.cos(heading)
  });
}

export function cameraRightVector(heading: number): MovementVector {
  return normalize2D({
    x: Math.cos(heading),
    z: -Math.sin(heading)
  });
}

export function movementVectorFromInput({ heading, forward, right }: MovementInput): MovementVector {
  const forwardVector = cameraForwardVector(heading);
  const rightVector = cameraRightVector(heading);

  return normalize2D({
    x: forwardVector.x * forward + rightVector.x * right,
    z: forwardVector.z * forward + rightVector.z * right
  });
}
