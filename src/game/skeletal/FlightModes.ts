import { Vector3 } from "three";
import type { KeyboardInputState } from "./CharacterController.js";

export type TravelMode = "ground" | "sword" | "cloud";
export type FlightMode = Exclude<TravelMode, "ground">;

export const FLIGHT_PROFILES = {
  sword: { speed: 3.2, runSpeed: 6.2, inertia: 0.12 },
  cloud: { speed: 4.5, runSpeed: 8.5, inertia: 0.24 }
} as const;

export interface FlightControllerOptions {
  initialPosition?: { x: number; y: number; z: number };
  minAltitude?: number;
  maxAltitude?: number;
  minClearance?: number;
  verticalSpeed?: number;
}

export interface FlightControllerHandle {
  position: Vector3;
  getHeading(): number;
  setHeading(value: number): void;
  getSpeed(): number;
  getMode(): TravelMode;
  setMode(mode: TravelMode, groundY?: number): void;
  update(dt: number, input: KeyboardInputState, inputYaw?: number): void;
}

export function cycleTravelMode(mode: TravelMode): TravelMode {
  if (mode === "ground") return "sword";
  if (mode === "sword") return "cloud";
  return "ground";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function shortestAngleDelta(target: number, current: number): number {
  let delta = target - current;
  while (delta > Math.PI) delta -= 2 * Math.PI;
  while (delta < -Math.PI) delta += 2 * Math.PI;
  return delta;
}

export function createFlightController(
  options: FlightControllerOptions = {}
): FlightControllerHandle {
  const {
    initialPosition = { x: 0, y: 3, z: 0 },
    minAltitude = 1.5,
    maxAltitude = 28,
    minClearance = 1.6,
    verticalSpeed = 3.5
  } = options;

  const position = new Vector3(initialPosition.x, initialPosition.y, initialPosition.z);
  const velocity = new Vector3();
  let heading = 0;
  let speed = 0;
  let mode: TravelMode = "ground";

  return {
    position,
    getHeading() {
      return heading;
    },
    setHeading(value) {
      heading = value;
    },
    getSpeed() {
      return speed;
    },
    getMode() {
      return mode;
    },
    setMode(nextMode, groundY = position.y) {
      mode = nextMode;
      velocity.set(0, 0, 0);
      speed = 0;
      if (nextMode === "ground") {
        position.y = groundY;
        return;
      }
      position.y = Math.max(position.y, groundY + minClearance);
      position.y = clamp(position.y, minAltitude, maxAltitude);
    },
    update(dt, input, inputYaw = 0) {
      if (mode === "ground") return;

      let inputX = 0;
      let inputZ = 0;
      if (input.forward) inputX += 1;
      if (input.backward) inputX -= 1;
      if (input.left) inputZ -= 1;
      if (input.right) inputZ += 1;

      const magnitude = Math.hypot(inputX, inputZ);
      const profile = FLIGHT_PROFILES[mode];
      const targetVelocity = new Vector3();

      if (magnitude > 0) {
        inputX /= magnitude;
        inputZ /= magnitude;
        const targetHeading = Math.atan2(-inputZ, inputX) + inputYaw;
        heading += shortestAngleDelta(targetHeading, heading) * 0.28;
        const targetSpeed = input.shift ? profile.runSpeed : profile.speed;
        targetVelocity.set(Math.cos(targetHeading) * targetSpeed, 0, -Math.sin(targetHeading) * targetSpeed);
      }

      velocity.x += (targetVelocity.x - velocity.x) * profile.inertia;
      velocity.z += (targetVelocity.z - velocity.z) * profile.inertia;
      position.x += velocity.x * dt;
      position.z += velocity.z * dt;

      let vertical = 0;
      if (input.ascend) vertical += verticalSpeed;
      if (input.descend) vertical -= verticalSpeed;
      position.y = clamp(position.y + vertical * dt, minAltitude, maxAltitude);
      speed = Math.hypot(velocity.x, velocity.z);
    }
  };
}
