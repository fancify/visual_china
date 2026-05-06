export interface AudioRuntime {
  context: AudioContext;
  masterGain: GainNode;
  buffers: Map<string, AudioBuffer>;
  /** true 一旦用户首次交互后 resume 过 */
  unlocked: boolean;
}

function resolveAudioContextCtor(): typeof AudioContext {
  const runtimeGlobal = globalThis as typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };
  const ctor = runtimeGlobal.AudioContext ?? runtimeGlobal.webkitAudioContext;
  if (!ctor) {
    throw new Error("Web Audio API is not available in this environment.");
  }
  return ctor;
}

/** 整体输出音量。用户偏好"似有似无"，0.25 仍嘈杂——再降到 0.15 让一切刚好"听得到没存在感"。 */
export const MASTER_GAIN_DEFAULT = 0.15;

export function createAudioRuntime(): AudioRuntime {
  const AudioContextCtor = resolveAudioContextCtor();
  const context = new AudioContextCtor();
  const masterGain = context.createGain();
  masterGain.gain.value = MASTER_GAIN_DEFAULT;
  masterGain.connect(context.destination);

  return {
    context,
    masterGain,
    buffers: new Map(),
    unlocked: false
  };
}

export function unlockOnUserGesture(runtime: AudioRuntime): void {
  if (typeof document === "undefined") {
    return;
  }

  const unlock = () => {
    runtime.context.resume()
      .then(() => {
        runtime.unlocked = true;
      })
      .catch((error: unknown) => {
        console.warn("[audio] failed to unlock context", error);
      });
  };

  document.addEventListener("pointerdown", unlock, { once: true });
  document.addEventListener("keydown", unlock, { once: true });
}

export function setMasterMuted(runtime: AudioRuntime, muted: boolean): void {
  const value = muted ? 0 : MASTER_GAIN_DEFAULT;
  runtime.masterGain.gain.setValueAtTime(value, runtime.context.currentTime);
}
