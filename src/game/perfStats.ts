import type { WebGLRenderer } from "three";

interface PerfStatsHandle {
  element: HTMLElement;
  beginFrame(): void;
  endFrame(renderer: WebGLRenderer): void;
  dispose(): void;
}

interface PerfStatsOptions {
  enabled?: boolean;
  updateIntervalMs?: number;
}

const DEFAULT_OPTIONS: Required<PerfStatsOptions> = {
  enabled: true,
  updateIntervalMs: 500
};

export function createPerfStats(
  options: PerfStatsOptions = {}
): PerfStatsHandle {
  const config = { ...DEFAULT_OPTIONS, ...options };
  const element = document.createElement("div");
  element.className = "perf-stats";
  element.setAttribute("aria-hidden", "true");
  element.hidden = !config.enabled;

  if (!document.querySelector("#perf-stats-style")) {
    const style = document.createElement("style");
    style.id = "perf-stats-style";
    style.textContent = `
      .perf-stats {
        position: fixed;
        bottom: 10px;
        left: 10px;
        z-index: 9999;
        padding: 8px 10px;
        font: 11px/1.45 ui-monospace, "SF Mono", Menlo, monospace;
        color: #d8e6df;
        background: rgba(8, 18, 19, 0.78);
        border: 1px solid rgba(120, 200, 200, 0.18);
        border-radius: 6px;
        pointer-events: none;
        min-width: 180px;
        white-space: pre;
      }
      .perf-stats .label { color: rgba(216, 230, 223, 0.55); }
      .perf-stats .value-warn { color: #f0b674; }
      .perf-stats .value-bad { color: #e08267; }
    `;
    document.head.appendChild(style);
  }

  let frameStart = 0;
  let frameCount = 0;
  let frameMsAccum = 0;
  let lastUpdate = performance.now();

  function format(): string {
    return "frame ……";
  }

  element.textContent = format();

  function refresh(renderer: WebGLRenderer, fps: number, frameMs: number): void {
    const info = renderer.info;
    const fpsClass = fps < 30 ? "value-bad" : fps < 50 ? "value-warn" : "";
    const calls = info.render.calls;
    const callsClass =
      calls > 600 ? "value-bad" : calls > 350 ? "value-warn" : "";
    const triangles = info.render.triangles;
    const trianglesClass =
      triangles > 800_000
        ? "value-bad"
        : triangles > 350_000
          ? "value-warn"
          : "";

    element.innerHTML = [
      `<span class="label">fps   </span><span class="${fpsClass}">${fps.toFixed(0).padStart(4)}</span>`,
      `<span class="label">ms    </span>${frameMs.toFixed(2).padStart(6)}`,
      `<span class="label">calls </span><span class="${callsClass}">${calls.toString().padStart(5)}</span>`,
      `<span class="label">tris  </span><span class="${trianglesClass}">${triangles.toLocaleString().padStart(8)}</span>`,
      `<span class="label">geom  </span>${info.memory.geometries.toString().padStart(5)}`,
      `<span class="label">tex   </span>${info.memory.textures.toString().padStart(5)}`,
      `<span class="label">prog  </span>${(info.programs?.length ?? 0).toString().padStart(5)}`
    ].join("\n");
  }

  return {
    element,
    beginFrame() {
      if (!config.enabled) return;
      frameStart = performance.now();
    },
    endFrame(renderer) {
      if (!config.enabled) return;
      const now = performance.now();
      frameMsAccum += now - frameStart;
      frameCount += 1;

      if (now - lastUpdate >= config.updateIntervalMs) {
        const elapsed = (now - lastUpdate) / 1000;
        const fps = frameCount / elapsed;
        const frameMs = frameMsAccum / Math.max(1, frameCount);
        refresh(renderer, fps, frameMs);
        frameCount = 0;
        frameMsAccum = 0;
        lastUpdate = now;
      }
    },
    dispose() {
      element.remove();
    }
  };
}

export function isDevModeEnabled(): boolean {
  if (typeof import.meta === "undefined") {
    return false;
  }

  const env = (import.meta as { env?: { DEV?: boolean } }).env;
  return env?.DEV === true;
}
