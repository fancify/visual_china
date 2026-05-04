import type { AmbientLayerSnapshot } from "./audio/ambientMixer";
import type { FireRecord } from "./audio/triggerSystem";

export interface AudioDebugHud {
  setVisible(visible: boolean): void;
  isVisible(): boolean;
  toggle(): void;
  /** 每帧或 200ms tick 调一次 */
  refresh(snapshot: {
    activeLayers: AmbientLayerSnapshot[];
    recentFires: FireRecord[];
    nowSec: number;
    masterGainValue: number;
  }): void;
  destroy(): void;
}

const STYLE_ID = "audio-debug-hud-style";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatGainBar(gain: number): string {
  const filled = Math.max(0, Math.min(5, Math.round(gain * 5)));
  return `${"▮".repeat(filled)}${"▯".repeat(5 - filled)}`;
}

function ensureStyles(): void {
  if (document.querySelector(`#${STYLE_ID}`)) {
    return;
  }

  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .audio-debug-hud {
      position: absolute;
      top: 72px;
      right: 18px;
      z-index: 3;
      width: min(280px, calc(100vw - 36px));
      padding: 10px 11px;
      border: 1px solid rgba(196, 223, 213, 0.16);
      border-radius: 10px;
      background: rgba(15, 21, 23, 0.65);
      color: #dfe9e3;
      font: 11px/1.45 ui-monospace, "SF Mono", Menlo, Monaco, Consolas, monospace;
      backdrop-filter: blur(14px);
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.24);
      pointer-events: none;
    }
    .audio-debug-hud:not(.audio-debug-hud-visible) {
      display: none;
    }
    .audio-debug-section + .audio-debug-section {
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px solid rgba(223, 233, 227, 0.12);
    }
    .audio-debug-title {
      margin-bottom: 4px;
      color: rgba(223, 233, 227, 0.78);
    }
    .audio-debug-list {
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .audio-debug-item {
      margin: 0;
    }
    .audio-debug-empty {
      color: rgba(223, 233, 227, 0.46);
    }
  `;
  document.head.appendChild(style);
}

function renderActiveLayers(activeLayers: AmbientLayerSnapshot[]): string {
  if (activeLayers.length === 0) {
    return '<li class="audio-debug-item audio-debug-empty">none</li>';
  }

  return activeLayers
    .map(
      ({ trackId, currentGain, triggerLabel }) =>
        `<li class="audio-debug-item">${escapeHtml(trackId)} ${formatGainBar(
          currentGain
        )} ${currentGain.toFixed(2)} · ${escapeHtml(triggerLabel)}</li>`
    )
    .join("");
}

function renderRecentFires(
  recentFires: FireRecord[],
  nowSec: number
): string {
  if (recentFires.length === 0) {
    return '<li class="audio-debug-item audio-debug-empty">none</li>';
  }

  return recentFires
    .map(({ id, ts, reason }) => {
      const agoSec = Math.max(0, nowSec - ts).toFixed(1);
      return `<li class="audio-debug-item">${agoSec}s ${escapeHtml(
        id
      )} · ${escapeHtml(reason)}</li>`;
    })
    .join("");
}

export function createAudioDebugHud(parent: HTMLElement): AudioDebugHud {
  ensureStyles();

  const element = document.createElement("div");
  element.className = "audio-debug-hud";
  element.hidden = true;
  parent.appendChild(element);

  let visible = false;

  function syncVisibility(): void {
    element.classList.toggle("audio-debug-hud-visible", visible);
    element.hidden = !visible;
  }

  syncVisibility();

  return {
    setVisible(nextVisible: boolean) {
      visible = nextVisible;
      syncVisibility();
    },
    isVisible() {
      return visible;
    },
    toggle() {
      visible = !visible;
      syncVisibility();
    },
    refresh({ activeLayers, recentFires, nowSec, masterGainValue }) {
      element.innerHTML = `
        <div class="audio-debug-section">
          <div class="audio-debug-title">环境音 (${masterGainValue.toFixed(2)})</div>
          <ul class="audio-debug-list">${renderActiveLayers(activeLayers)}</ul>
        </div>
        <div class="audio-debug-section">
          <div class="audio-debug-title">事件音（最近 5）</div>
          <ul class="audio-debug-list">${renderRecentFires(recentFires, nowSec)}</ul>
        </div>
      `;
    },
    destroy() {
      element.remove();
    }
  };
}
