import type { TravelMode } from "./FlightModes.js";
import type { MovementMode } from "./CharacterController.js";

export function resolveTravelAnimationMode(
  travelMode: TravelMode,
  groundMode: MovementMode,
  _shiftHeld: boolean
): MovementMode {
  return travelMode === "ground" ? groundMode : "idle";
}
