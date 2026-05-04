import type { WebGLRenderer } from "three";

const MB = 1024 * 1024;

interface PerfMemoryLike {
  usedJSHeapSize?: number;
}

interface PerfMonitorInternalOptions extends PerfMonitorOptions {
  getActiveChunkCount?: () => number;
}

export interface PerfMonitorOptions {
  spikeMultiplier?: number;
  bufferSize?: number;
  warnOnVisible?: boolean;
}

export interface PerfFrameSample {
  ms: number;
  calls: number;
  triangles: number;
  geometries: number;
  textures: number;
  programs: number;
  heapUsed?: number;
  documentVisible: boolean;
}

export interface PerfMonitor {
  observe(renderer: WebGLRenderer, frameMs: number): void;
  getRecentFrames(): PerfFrameSample[];
}

const DEFAULT_OPTIONS: Required<PerfMonitorOptions> = {
  spikeMultiplier: 3,
  bufferSize: 60,
  warnOnVisible: false
};

export function createPerfMonitor(
  options: PerfMonitorInternalOptions = {}
): PerfMonitor {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const recentFrames: PerfFrameSample[] = [];
  const recentFrameMs: number[] = [];
  const heapHistory: Array<{ time: number; used: number }> = [];

  function observe(renderer: WebGLRenderer, frameMs: number): void {
    const now = performance.now();
    const visible = isDocumentVisible();
    const info = renderer.info;
    const sample: PerfFrameSample = {
      ms: frameMs,
      calls: info.render.calls,
      triangles: info.render.triangles,
      geometries: info.memory.geometries,
      textures: info.memory.textures,
      programs: info.programs?.length ?? 0,
      heapUsed: readHeapUsed(),
      documentVisible: visible
    };
    const previousSample =
      recentFrames.length > 0 ? recentFrames[recentFrames.length - 1] : undefined;
    const medianMs =
      recentFrameMs.length >= config.bufferSize ? median(recentFrameMs) : null;
    const lastFiveMs = [...recentFrames.slice(-4), sample].map((frame) => frame.ms);
    const heapGrowth = growthVsOneSecondAgo(heapHistory, now, sample.heapUsed);

    if (
      medianMs !== null &&
      sample.ms > medianMs * config.spikeMultiplier &&
      (visible || config.warnOnVisible)
    ) {
      const activeChunkCount = safeReadActiveChunkCount(options.getActiveChunkCount);
      const lines = [
        `FPS spike at ${new Date().toISOString()}: ${sample.ms.toFixed(2)}ms (median ${medianMs.toFixed(2)}ms)`,
        `calls ${sample.calls} (${formatDelta(sample.calls, previousSample?.calls)}) tris ${sample.triangles} (${formatDelta(sample.triangles, previousSample?.triangles)}) geom ${sample.geometries} (${formatDelta(sample.geometries, previousSample?.geometries)}) tex ${sample.textures} prog ${sample.programs}`,
        `tab visible: ${sample.documentVisible} active chunks: ${activeChunkCount ?? "n/a"}`,
        `recent ms: ${lastFiveMs.map((ms) => ms.toFixed(2)).join(", ")}`
      ];

      if (heapGrowth !== null && heapGrowth > 20 * MB) {
        lines.push("GC hint: likely GC after major allocation");
      }

      console.warn(lines.join("\n"));
    }

    recentFrames.push(sample);
    recentFrameMs.push(sample.ms);

    while (recentFrames.length > config.bufferSize) {
      recentFrames.shift();
    }

    while (recentFrameMs.length > config.bufferSize) {
      recentFrameMs.shift();
    }

    if (sample.heapUsed !== undefined) {
      heapHistory.push({ time: now, used: sample.heapUsed });
      while (heapHistory.length > 0 && heapHistory[0] && heapHistory[0].time < now - 5000) {
        heapHistory.shift();
      }
    }
  }

  return {
    observe,
    getRecentFrames(): PerfFrameSample[] {
      return recentFrames.slice();
    }
  };
}

function isDocumentVisible(): boolean {
  if (typeof document === "undefined") {
    return true;
  }

  return document.hidden !== true;
}

function readHeapUsed(): number | undefined {
  const perf = performance as Performance & { memory?: PerfMemoryLike };
  return perf.memory?.usedJSHeapSize;
}

function median(values: number[]): number {
  const sorted = values.slice().sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[middle - 1] + sorted[middle]) / 2;
  }

  return sorted[middle] ?? 0;
}

function formatDelta(current: number, previous?: number): string {
  const delta = current - (previous ?? 0);
  return `${delta >= 0 ? "+" : ""}${delta}`;
}

function growthVsOneSecondAgo(
  heapHistory: Array<{ time: number; used: number }>,
  now: number,
  current?: number
): number | null {
  if (current === undefined) {
    return null;
  }

  const targetTime = now - 1000;
  for (let index = heapHistory.length - 1; index >= 0; index -= 1) {
    const entry = heapHistory[index];
    if (entry && entry.time <= targetTime) {
      return current - entry.used;
    }
  }

  return null;
}

function safeReadActiveChunkCount(
  getActiveChunkCount?: () => number
): number | null {
  if (!getActiveChunkCount) {
    return null;
  }

  try {
    return getActiveChunkCount();
  } catch {
    return null;
  }
}
