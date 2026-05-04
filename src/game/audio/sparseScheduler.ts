import type { AmbientContext } from "./ambientMixer";
import type { TriggerSystem } from "./triggerSystem";

export type SparseTriggerKey =
  | "bird_chirp"
  | "bird_distant_song"
  | "cicada_burst"
  | "frog_call"
  | "owl_hoot"
  | "wind_gust";

export interface SparseTriggerRule {
  key: SparseTriggerKey;
  condition: (ctx: AmbientContext) => boolean;
  minIntervalMs: number;
  maxIntervalMs: number;
  volume?: number;
}

export interface SparseScheduler {
  setContext(ctx: AmbientContext): void;
  tick(elapsedMs: number): void;
}

interface RuleState {
  elapsedMs: number;
  nextFireMs: number;
  active: boolean;
}

const DEFAULT_VOLUME = 0.3;
const SAMPLE_POOL: Record<SparseTriggerKey, string[]> = {
  bird_chirp: ["bird_chirp_a", "bird_chirp_b", "bird_chirp_c"],
  bird_distant_song: ["bird_distant_song_a", "bird_distant_song_b"],
  cicada_burst: ["cicada_burst_a", "cicada_burst_b"],
  frog_call: ["frog_call_a", "frog_call_b"],
  owl_hoot: ["owl_hoot"],
  wind_gust: ["wind_gust_a", "wind_gust_b"]
};

export const DEFAULT_SPARSE_RULES: SparseTriggerRule[] = [
  {
    key: "bird_chirp",
    condition: (ctx) => !ctx.isNight && (ctx.biome === "forest" || ctx.biome === "subtropical"),
    minIntervalMs: 25_000,
    maxIntervalMs: 60_000,
    volume: 0.4
  },
  {
    key: "bird_distant_song",
    condition: (ctx) => !ctx.isNight,
    minIntervalMs: 45_000,
    maxIntervalMs: 120_000,
    volume: 0.28
  },
  {
    key: "cicada_burst",
    condition: (ctx) => ctx.isNight && ctx.biome !== "highland",
    minIntervalMs: 18_000,
    maxIntervalMs: 50_000,
    volume: 0.38
  },
  {
    key: "frog_call",
    condition: (ctx) => ctx.isNight && (ctx.biome === "basin" || ctx.biome === "subtropical"),
    minIntervalMs: 22_000,
    maxIntervalMs: 75_000,
    volume: 0.32
  },
  {
    key: "owl_hoot",
    condition: (ctx) => ctx.isNight,
    minIntervalMs: 90_000,
    maxIntervalMs: 240_000,
    volume: 0.36
  },
  {
    key: "wind_gust",
    condition: (ctx) => ctx.altitudeBand === "high" || ctx.biome === "plain",
    minIntervalMs: 30_000,
    maxIntervalMs: 90_000,
    volume: 0.32
  }
];

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomItem<T>(items: T[]): T {
  const index = Math.min(items.length - 1, Math.floor(Math.random() * items.length));
  return items[index]!;
}

function defaultContext(): AmbientContext {
  return {
    biome: "plain",
    isNight: false,
    weather: "clear",
    altitudeBand: "mid",
    riverProximity: 0,
    largeRiverProximity: 0
  };
}

export function createSparseScheduler(
  triggerSystem: TriggerSystem,
  rules: SparseTriggerRule[]
): SparseScheduler {
  const states = rules.map<RuleState>(() => ({
    elapsedMs: 0,
    nextFireMs: 0,
    active: false
  }));
  let currentContext = defaultContext();

  function resetRule(state: RuleState, rule: SparseTriggerRule): void {
    state.elapsedMs = 0;
    state.nextFireMs = randomBetween(rule.minIntervalMs, rule.maxIntervalMs);
  }

  return {
    setContext(ctx: AmbientContext) {
      currentContext = ctx;
    },
    tick(elapsedMs: number) {
      rules.forEach((rule, index) => {
        const state = states[index]!;
        const conditionMet = rule.condition(currentContext);

        if (!conditionMet) {
          state.active = false;
          return;
        }

        if (!state.active) {
          state.active = true;
          resetRule(state, rule);
        }

        state.elapsedMs += elapsedMs;
        while (state.elapsedMs >= state.nextFireMs) {
          state.elapsedMs -= state.nextFireMs;
          triggerSystem.fire(randomItem(SAMPLE_POOL[rule.key]), {
            volume: rule.volume ?? DEFAULT_VOLUME,
            reason: `sparse:${rule.key}`
          });
          resetRule(state, rule);
        }
      });
    }
  };
}
