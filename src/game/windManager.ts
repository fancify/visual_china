import { Vector2 } from "three";

export interface WindUniforms {
  /** 世界空间 x/z 单位向量，所有风驱动 shader 共用同一个方向源。 */
  direction: { value: Vector2 };
  /** 0..1 的基础风强度。 */
  strength: { value: number };
  /** 0..1 的瞬时阵风脉冲强度。 */
  gust: { value: number };
  /** 累积秒数，shader 用它推导 scroll / sway 相位。 */
  time: { value: number };
  /** world units per noise tile，后续草风/落叶噪声也走同一尺度。 */
  noiseScale: { value: number };
}

export interface WindState {
  wind?: number;
  gust?: number;
  direction?: Vector2;
}

export class WindManager {
  readonly uniforms: WindUniforms;
  private elapsedSec = 0;

  constructor() {
    this.uniforms = {
      direction: { value: new Vector2(0.86, 0.5).normalize() },
      strength: { value: 0.4 },
      gust: { value: 0 },
      time: { value: 0 },
      // R7.1: 200u 太大，视野 ~70u 内无 cookie contrast。改 80u (1 chunk size × 5-6) 让视野能看到 ~1 完整云影 tile。
      noiseScale: { value: 80 }
    };
  }

  update(dt: number, weatherState: WindState): void {
    this.elapsedSec += Math.max(0, dt);
    this.uniforms.time.value = this.elapsedSec;

    if (weatherState.direction) {
      this.uniforms.direction.value.copy(weatherState.direction);
      if (this.uniforms.direction.value.lengthSq() > 0.000001) {
        this.uniforms.direction.value.normalize();
      }
    }

    this.uniforms.strength.value = weatherState.wind ?? 0.4;
    this.uniforms.gust.value = weatherState.gust ?? 0;
  }
}
