export interface EngineAxisVector {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface EngineAxisContract {
  readonly description: string;
}

export const ENGINE_CAMERA_FORWARD_AXIS: EngineAxisVector;
export const ENGINE_CAMERA_RIGHT_AXIS: EngineAxisVector;
export const ENGINE_CAMERA_UP_AXIS: EngineAxisVector;
export const ENGINE_AXIS_CONTRACT: EngineAxisContract;
