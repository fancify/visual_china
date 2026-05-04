import type { AudioRuntime } from "./audioContext";

export interface AmbientContext {
  biome: "forest" | "plain" | "highland" | "subtropical" | "basin";
  isNight: boolean;
  weather: "clear" | "rain" | "storm";
  altitudeBand: "low" | "mid" | "high";
  riverProximity: number;
  largeRiverProximity: number;
}

export interface AmbientMixer {
  setContext(ctx: AmbientContext): void;
  /** 每帧或者 200ms tick 调用一次。内部 throttle */
  tick(elapsedMs: number): void;
  getActiveLayers(): AmbientLayerSnapshot[];
}

export type LoopTrackId =
  | "ambient_forest_birds"
  | "ambient_insects_night"
  | "ambient_wind_plain"
  | "ambient_mountain_wind"
  | "ambient_rain_heavy"
  | "ambient_stream_water"
  | "ambient_river_large";

export interface AmbientLayerSnapshot {
  trackId: LoopTrackId;
  currentGain: number;
  /** 最近一次给到这个 layer 的 trigger 描述，用于 HUD 显示 */
  triggerLabel: string;
}

interface AmbientTrackTarget {
  gain: number;
  triggerLabel: string;
}

interface TrackState {
  buffer: AudioBuffer | null;
  gain: GainNode | null;
  source: AudioBufferSourceNode | null;
  startGain: number;
  targetGain: number;
  transitionStartedAt: number;
  transitionDurationSec: number;
  triggerLabel: string;
}

const LOOP_TRACK_IDS: LoopTrackId[] = [
  "ambient_forest_birds",
  "ambient_insects_night",
  "ambient_wind_plain",
  "ambient_mountain_wind",
  "ambient_rain_heavy",
  "ambient_stream_water",
  "ambient_river_large"
];
const CROSSFADE_SECONDS = 1.5;
const TICK_THROTTLE_MS = 200;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function defaultAmbientContext(): AmbientContext {
  return {
    biome: "plain",
    isNight: false,
    weather: "clear",
    altitudeBand: "mid",
    riverProximity: 0,
    largeRiverProximity: 0
  };
}

function baseTriggerLabel(
  label: string,
  ctx: AmbientContext
): string {
  return ctx.weather === "clear" ? label : `${label}, weather=${ctx.weather}`;
}

function targetGainsForContext(ctx: AmbientContext): Map<LoopTrackId, AmbientTrackTarget> {
  const targets = new Map<LoopTrackId, AmbientTrackTarget>(
    LOOP_TRACK_IDS.map((id) => [
      id,
      { gain: 0, triggerLabel: "" }
    ])
  );
  const weatherDucking = ctx.weather === "clear" ? 1 : 0.2;

  if (ctx.biome === "highland" || ctx.altitudeBand === "high") {
    targets.set("ambient_mountain_wind", {
      gain: 0.7 * weatherDucking,
      triggerLabel: baseTriggerLabel(
        ctx.biome === "highland" ? "biome=highland" : "altitude=high",
        ctx
      )
    });
  } else if (ctx.biome === "forest") {
    targets.set(ctx.isNight ? "ambient_insects_night" : "ambient_forest_birds", {
      gain: ctx.isNight ? 0.5 * weatherDucking : 0.6 * weatherDucking,
      triggerLabel: baseTriggerLabel(
        ctx.isNight ? "biome=forest, night" : "biome=forest, day",
        ctx
      )
    });
  } else if (ctx.biome === "plain") {
    targets.set("ambient_wind_plain", {
      gain: 0.5 * weatherDucking,
      triggerLabel: baseTriggerLabel("biome=plain, day", ctx)
    });
  } else if (ctx.biome === "basin") {
    targets.set(ctx.isNight ? "ambient_insects_night" : "ambient_wind_plain", {
      gain: ctx.isNight ? 0.5 * weatherDucking : 0.45 * weatherDucking,
      triggerLabel: baseTriggerLabel(
        ctx.isNight ? "biome=basin, night" : "biome=basin, day",
        ctx
      )
    });
  } else {
    targets.set(ctx.isNight ? "ambient_insects_night" : "ambient_forest_birds", {
      gain: ctx.isNight ? 0.5 * weatherDucking : 0.38 * weatherDucking,
      triggerLabel: baseTriggerLabel(
        ctx.isNight ? `biome=${ctx.biome}, night` : `biome=${ctx.biome}, day`,
        ctx
      )
    });
  }

  if (ctx.weather === "rain" || ctx.weather === "storm") {
    targets.set("ambient_rain_heavy", {
      gain: 0.7,
      triggerLabel: `weather=${ctx.weather}`
    });
  }

  if (ctx.riverProximity > 0.4) {
    targets.set("ambient_stream_water", {
      gain: clamp01(ctx.riverProximity) * 0.6,
      triggerLabel: `river-proximity=${clamp01(ctx.riverProximity).toFixed(2)}`
    });
  }

  if (ctx.largeRiverProximity > 0.4) {
    targets.set("ambient_river_large", {
      gain: clamp01(ctx.largeRiverProximity) * 0.7,
      triggerLabel: `large-river-proximity=${clamp01(
        ctx.largeRiverProximity
      ).toFixed(2)}`
    });
  }

  return targets;
}

function currentGainAtTime(state: TrackState, now: number): number {
  if (state.transitionDurationSec <= 0) {
    return state.targetGain;
  }

  const progress = clamp01(
    (now - state.transitionStartedAt) / state.transitionDurationSec
  );
  return state.startGain + (state.targetGain - state.startGain) * progress;
}

export function createAmbientMixer(runtime: AudioRuntime): AmbientMixer {
  const trackStates = new Map<LoopTrackId, TrackState>(
    LOOP_TRACK_IDS.map((id) => [
      id,
      {
        buffer: null,
        gain: null,
        source: null,
        startGain: 0,
        targetGain: 0,
        transitionStartedAt: 0,
        transitionDurationSec: 0,
        triggerLabel: ""
      }
    ])
  );
  let currentContext = defaultAmbientContext();
  let elapsedSinceApplyMs = TICK_THROTTLE_MS;
  let dirty = true;

  function ensureLoopTrack(trackId: LoopTrackId): TrackState {
    const state = trackStates.get(trackId)!;
    const buffer = runtime.buffers.get(trackId) ?? null;

    if (!buffer) {
      return state;
    }

    if (state.buffer === buffer && state.gain && state.source) {
      return state;
    }

    if (state.source) {
      state.source.disconnect();
    }
    if (state.gain) {
      state.gain.disconnect();
    }

    const gain = runtime.context.createGain();
    const source = runtime.context.createBufferSource();
    gain.gain.value = currentGainAtTime(state, runtime.context.currentTime);
    gain.connect(runtime.masterGain);
    source.buffer = buffer;
    source.loop = true;
    source.connect(gain);
    source.start();

    (gain as GainNode & { __trackId?: string }).__trackId = trackId;
    (source as AudioBufferSourceNode & { __trackId?: string }).__trackId = trackId;

    state.buffer = buffer;
    state.gain = gain;
    state.source = source;
    return state;
  }

  function applyTargetGains(): void {
    const now = runtime.context.currentTime;
    const targets = targetGainsForContext(currentContext);

    LOOP_TRACK_IDS.forEach((trackId) => {
      const state = ensureLoopTrack(trackId);
      const target = targets.get(trackId) ?? { gain: 0, triggerLabel: "" };
      const currentGain = currentGainAtTime(state, now);

      state.startGain = currentGain;
      state.targetGain = target.gain;
      state.transitionStartedAt = now;
      state.transitionDurationSec = CROSSFADE_SECONDS;
      if (target.gain > 0) {
        state.triggerLabel = target.triggerLabel;
      }

      if (!state.gain) {
        return;
      }

      const param = state.gain.gain;
      param.cancelScheduledValues(now);
      param.setValueAtTime(currentGain, now);
      param.linearRampToValueAtTime(target.gain, now + CROSSFADE_SECONDS);
    });

    elapsedSinceApplyMs = 0;
    dirty = false;
  }

  return {
    setContext(ctx: AmbientContext) {
      currentContext = {
        ...ctx,
        riverProximity: clamp01(ctx.riverProximity),
        largeRiverProximity: clamp01(ctx.largeRiverProximity)
      };
      dirty = true;
      applyTargetGains();
    },
    tick(elapsedMs: number) {
      elapsedSinceApplyMs += elapsedMs;
      if (!dirty && elapsedSinceApplyMs < TICK_THROTTLE_MS) {
        return;
      }
      applyTargetGains();
    },
    getActiveLayers() {
      const now = runtime.context.currentTime;

      return LOOP_TRACK_IDS.flatMap((trackId) => {
        const state = trackStates.get(trackId)!;
        const currentGain = currentGainAtTime(state, now);

        if (currentGain <= 0.01) {
          return [];
        }

        return [
          {
            trackId,
            currentGain,
            triggerLabel: state.triggerLabel
          }
        ];
      });
    }
  };
}
