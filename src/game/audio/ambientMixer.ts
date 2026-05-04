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
  tick(elapsedMs: number): void;
  getActiveLayers(): AmbientLayerSnapshot[];
}

export type LoopTrackId =
  | "ambient_soft_wind"
  | "ambient_rain_heavy";

export interface AmbientLayerSnapshot {
  trackId: LoopTrackId;
  currentGain: number;
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
  "ambient_soft_wind",
  "ambient_rain_heavy"
];
const CROSSFADE_SECONDS = 1.5;
const TICK_THROTTLE_MS = 200;
const RAIN_GAIN = 0.6;

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

export function targetGainForContext(ctx: AmbientContext): number {
  if (ctx.weather === "rain" || ctx.weather === "storm") {
    return 0;
  }
  if (ctx.altitudeBand === "high") {
    return 0.08;
  }
  return 0.04;
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

function buildTargetMap(ctx: AmbientContext): Map<LoopTrackId, AmbientTrackTarget> {
  const windGain = targetGainForContext(ctx);
  return new Map<LoopTrackId, AmbientTrackTarget>([
    [
      "ambient_soft_wind",
      {
        gain: windGain,
        triggerLabel: `weather=${ctx.weather}, altitude=${ctx.altitudeBand}`
      }
    ],
    [
      "ambient_rain_heavy",
      {
        gain: ctx.weather === "rain" || ctx.weather === "storm" ? RAIN_GAIN : 0,
        triggerLabel: `weather=${ctx.weather}`
      }
    ]
  ]);
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
    const targets = buildTargetMap(currentContext);

    LOOP_TRACK_IDS.forEach((trackId) => {
      const state = ensureLoopTrack(trackId);
      const target = targets.get(trackId)!;
      const currentGain = currentGainAtTime(state, now);

      state.startGain = currentGain;
      state.targetGain = target.gain;
      state.transitionStartedAt = now;
      state.transitionDurationSec = CROSSFADE_SECONDS;
      state.triggerLabel = target.gain > 0 ? target.triggerLabel : "";

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
