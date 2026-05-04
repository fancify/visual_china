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
}

type LoopTrackId =
  | "ambient_forest_birds"
  | "ambient_insects_night"
  | "ambient_wind_plain"
  | "ambient_mountain_wind"
  | "ambient_rain_heavy"
  | "ambient_stream_water"
  | "ambient_river_large";

interface TrackState {
  buffer: AudioBuffer | null;
  gain: GainNode | null;
  source: AudioBufferSourceNode | null;
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

function targetGainsForContext(ctx: AmbientContext): Map<LoopTrackId, number> {
  const targets = new Map<LoopTrackId, number>(
    LOOP_TRACK_IDS.map((id) => [id, 0])
  );
  const weatherDucking = ctx.weather === "clear" ? 1 : 0.2;

  if (ctx.biome === "highland" || ctx.altitudeBand === "high") {
    targets.set("ambient_mountain_wind", 0.7 * weatherDucking);
  } else if (ctx.biome === "forest") {
    targets.set(
      ctx.isNight ? "ambient_insects_night" : "ambient_forest_birds",
      ctx.isNight ? 0.5 * weatherDucking : 0.6 * weatherDucking
    );
  } else if (ctx.biome === "plain") {
    targets.set("ambient_wind_plain", 0.5 * weatherDucking);
  } else if (ctx.biome === "basin") {
    targets.set(
      ctx.isNight ? "ambient_insects_night" : "ambient_wind_plain",
      ctx.isNight ? 0.5 * weatherDucking : 0.45 * weatherDucking
    );
  } else {
    targets.set(
      ctx.isNight ? "ambient_insects_night" : "ambient_forest_birds",
      ctx.isNight ? 0.5 * weatherDucking : 0.38 * weatherDucking
    );
  }

  if (ctx.weather === "rain" || ctx.weather === "storm") {
    targets.set("ambient_rain_heavy", 0.7);
  }

  if (ctx.riverProximity > 0.4) {
    targets.set("ambient_stream_water", clamp01(ctx.riverProximity) * 0.6);
  }

  if (ctx.largeRiverProximity > 0.4) {
    targets.set("ambient_river_large", clamp01(ctx.largeRiverProximity) * 0.7);
  }

  return targets;
}

export function createAmbientMixer(runtime: AudioRuntime): AmbientMixer {
  const trackStates = new Map<LoopTrackId, TrackState>(
    LOOP_TRACK_IDS.map((id) => [
      id,
      {
        buffer: null,
        gain: null,
        source: null
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
    gain.gain.value = state.gain?.gain.value ?? 0;
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
      if (!state.gain) {
        return;
      }

      const param = state.gain.gain;
      const currentValue = param.value;
      param.cancelScheduledValues(now);
      param.setValueAtTime(currentValue, now);
      param.linearRampToValueAtTime(targets.get(trackId) ?? 0, now + CROSSFADE_SECONDS);
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
    }
  };
}
