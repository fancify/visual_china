import type { AudioRuntime } from "./audioContext";

export interface FireRecord {
  id: string;
  /** AudioContext.currentTime 戳 */
  ts: number;
  /** 调用 fire 时的 reason 描述 */
  reason: string;
}

export interface TriggerSystem {
  /** 立即播一次某 id（带可选音量、随机偏调）。被 throttle / category cooldown 拦截则忽略。 */
  fire(
    id: string,
    opts?: { volume?: number; pitchSemitones?: number; reason?: string }
  ): void;
  getRecentFires(limit?: number): FireRecord[];
  /** 注册周期性 thunder 间隔 trigger（weather=storm 时） */
  setThunderActive(active: boolean): void;
  /**
   * 玩家步伐 phase tick → 触发 footstep。
   *
   * S3b: 用 `footstep: FootstepMaterial` 替代 `inWater: boolean`，让 audio
   * 跟 SurfaceProvider.sampleGround().state.footstep 同源（SSOT）。
   * 当前 audio buffer 只覆盖 grass + water + horse + ox；其他 footstep type
   * 暂 fallback 到 grass，但 API 已对齐 future S6 stone/snow/mud/wood 扩展。
   */
  footstepPulse(opts: {
    footstep: "grass" | "stone" | "water" | "snow" | "mud" | "wood";
    mounted: "ox" | "horse" | null;
  }): void;
}

type PlaybackOptions = {
  volume?: number;
  pitchSemitones?: number;
  reason?: string;
};

const UI_COOLDOWN_MS = 50;
const CULTURAL_COOLDOWN_MS = 8000;
const CRANE_COOLDOWN_MS = 12000;
const THUNDER_MIN_MS = 18000;
const THUNDER_MAX_MS = 35000;
const OX_MOO_MIN_MS = 25000;
const OX_MOO_MAX_MS = 40000;
const FIRE_HISTORY_LIMIT = 20;

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function playbackRateFromSemitones(semitones = 0): number {
  return 2 ** (semitones / 12);
}

function cooldownKeyForId(id: string): string | null {
  if (id === "cultural_magic_chime") {
    return null;
  }
  if (id === "cultural_crane_call") {
    return "cultural:crane";
  }
  if (id === "ambient_thunder_distant") {
    return "weather:thunder";
  }
  if (id === "mount_ox_moo") {
    return "mount:ox-moo";
  }
  if (id.startsWith("ui_")) {
    return "ui";
  }
  if (id.startsWith("cultural_")) {
    return "cultural";
  }
  return null;
}

function cooldownDurationMs(id: string): number {
  if (id === "cultural_crane_call") {
    return CRANE_COOLDOWN_MS;
  }
  if (id === "ambient_thunder_distant") {
    return randomBetween(THUNDER_MIN_MS, THUNDER_MAX_MS);
  }
  if (id === "mount_ox_moo") {
    return randomBetween(OX_MOO_MIN_MS, OX_MOO_MAX_MS);
  }
  if (id.startsWith("ui_")) {
    return UI_COOLDOWN_MS;
  }
  if (id.startsWith("cultural_")) {
    return CULTURAL_COOLDOWN_MS;
  }
  return 0;
}

function nowMs(): number {
  return Date.now();
}

function tagTrack(node: object, trackId: string): void {
  Object.assign(node, { __trackId: trackId });
}

export function createTriggerSystem(runtime: AudioRuntime): TriggerSystem {
  const cooldownUntil = new Map<string, number>();
  const fireHistory: FireRecord[] = [];
  let thunderActive = false;
  let thunderTimer: ReturnType<typeof setTimeout> | null = null;

  function playOneShot(id: string, opts: PlaybackOptions = {}): void {
    const buffer = runtime.buffers.get(id);
    if (!buffer) {
      return;
    }

    const source = runtime.context.createBufferSource();
    const gain = runtime.context.createGain();
    source.buffer = buffer;
    gain.gain.value = opts.volume ?? 1;
    source.playbackRate.value = playbackRateFromSemitones(opts.pitchSemitones ?? 0);
    source.connect(gain);
    gain.connect(runtime.masterGain);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
    };
    tagTrack(source, id);
    tagTrack(gain, id);
    source.start();
  }

  function recordFire(id: string, reason?: string): void {
    fireHistory.push({
      id,
      ts: runtime.context.currentTime,
      reason: reason ?? id
    });
    if (fireHistory.length > FIRE_HISTORY_LIMIT) {
      fireHistory.splice(0, fireHistory.length - FIRE_HISTORY_LIMIT);
    }
  }

  function tryFire(
    id: string,
    opts: PlaybackOptions = {},
    bypassCooldown = false
  ): void {
    const key = cooldownKeyForId(id);
    const now = nowMs();

    if (!bypassCooldown && key) {
      const blockedUntil = cooldownUntil.get(key) ?? 0;
      if (now < blockedUntil) {
        return;
      }
      cooldownUntil.set(key, now + cooldownDurationMs(id));
    }

    playOneShot(id, opts);
    recordFire(id, opts.reason);
  }

  function clearThunderTimer(): void {
    if (thunderTimer !== null) {
      clearTimeout(thunderTimer);
      thunderTimer = null;
    }
  }

  function scheduleThunder(): void {
    clearThunderTimer();
    if (!thunderActive) {
      return;
    }
    thunderTimer = setTimeout(() => {
      thunderTimer = null;
      tryFire(
        "ambient_thunder_distant",
        { volume: 0.88, reason: "weather:storm thunder" },
        true
      );
      scheduleThunder();
    }, randomBetween(THUNDER_MIN_MS, THUNDER_MAX_MS));
  }

  return {
    fire(id: string, opts?: PlaybackOptions) {
      tryFire(id, opts);
    },
    getRecentFires(limit = FIRE_HISTORY_LIMIT) {
      return fireHistory.slice(-limit).reverse();
    },
    setThunderActive(active: boolean) {
      if (thunderActive === active) {
        return;
      }
      thunderActive = active;
      if (!active) {
        clearThunderTimer();
        return;
      }
      scheduleThunder();
    },
    footstepPulse(opts) {
      let id = "footstep_grass";
      let pitchSemitones = Math.random() * 2 - 1;
      let reason = "footstep:grass";

      if (opts.mounted === "horse" && runtime.buffers.has("mount_horse_hoof")) {
        id = "mount_horse_hoof";
        pitchSemitones = Math.random() * 0.6 - 0.3;
        reason = "footstep:horse-hoof";
      } else if (opts.footstep === "water" && runtime.buffers.has("footstep_water_wading")) {
        id = "footstep_water_wading";
        reason = "footstep:water";
      }

      // 脚步只是底层质感，不该是焦点。整体经过 masterGain(0.25) 之后再过这道
      // 0.34 → 实际 ~0.085 的有效响度，"只听得到不显眼"。
      tryFire(id, { volume: 0.34, pitchSemitones, reason }, true);
    }
  };
}
