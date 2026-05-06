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
      top: 126px;
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
    .audio-debug-meta {
      color: rgba(196, 215, 207, 0.62);
      font-size: 10px;
    }
    .audio-debug-item + .audio-debug-item {
      margin-top: 6px;
    }
  `;
  document.head.appendChild(style);
}

// 中文 track 名称 + 触发条件 + 频率说明，让 HUD 可读不再是英文 id
const TRACK_LABEL_CN: Record<string, { name: string; trigger: string; frequency: string }> = {
  ambient_soft_wind: { name: "柔风", trigger: "天气晴时持续", frequency: "持续循环" },
  ambient_rain_heavy: { name: "雨声", trigger: "天气=雨/暴雨", frequency: "持续循环" },
  ambient_thunder_distant: { name: "远雷", trigger: "天气=暴雨", frequency: "18-35 秒间隔" },
  bird_chirp_a: { name: "鸟鸣 A", trigger: "白天 + 山林/亚热带", frequency: "25-60 秒间隔" },
  bird_chirp_b: { name: "鸟鸣 B", trigger: "白天 + 山林/亚热带", frequency: "25-60 秒间隔" },
  bird_chirp_c: { name: "鸟鸣 C", trigger: "白天 + 山林/亚热带", frequency: "25-60 秒间隔" },
  bird_distant_song_a: { name: "远处鸟唱 A", trigger: "白天", frequency: "45-120 秒间隔" },
  bird_distant_song_b: { name: "远处鸟唱 B", trigger: "白天", frequency: "45-120 秒间隔" },
  cicada_burst_a: { name: "蝉鸣 A", trigger: "夜晚 + 非高山", frequency: "18-50 秒间隔" },
  cicada_burst_b: { name: "蝉鸣 B", trigger: "夜晚 + 非高山", frequency: "18-50 秒间隔" },
  frog_call_a: { name: "蛙叫 A", trigger: "夜晚 + 盆地/亚热带", frequency: "22-75 秒间隔" },
  frog_call_b: { name: "蛙叫 B", trigger: "夜晚 + 盆地/亚热带", frequency: "22-75 秒间隔" },
  owl_hoot: { name: "猫头鹰啼", trigger: "夜晚", frequency: "90-240 秒间隔" },
  wind_gust_a: { name: "风急 A", trigger: "高海拔/平原", frequency: "30-90 秒间隔" },
  wind_gust_b: { name: "风急 B", trigger: "高海拔/平原", frequency: "30-90 秒间隔" },
  footstep_grass: { name: "草地脚步", trigger: "走路 + 非水非坐骑", frequency: "每步 0.45 秒" },
  footstep_water_wading: { name: "蹚水声", trigger: "走路 + 在河里", frequency: "每步 0.45 秒" },
  mount_horse_hoof: { name: "马蹄声", trigger: "骑马 + 走路", frequency: "每步 0.45 秒" },
  mount_ox_moo: { name: "牛叫", trigger: "骑牛", frequency: "25-40 秒概率触发" },
  ui_hover: { name: "UI 悬停", trigger: "hover POI", frequency: "每次悬停" },
  ui_click: { name: "UI 点击", trigger: "按 i 切换详情", frequency: "每次点击" },
  ui_page_turn: { name: "翻页", trigger: "atlas 切换", frequency: "每次切换" },
  cultural_magic_chime: { name: "新发现 chime", trigger: "首次走近 POI", frequency: "每个 POI 一次" },
  cultural_guqin_pluck: { name: "古琴拨弦", trigger: "进名胜 (10% 概率)", frequency: "8 秒冷却" },
  cultural_dizi_flute: { name: "笛声", trigger: "黄昏/进山林 (5%)", frequency: "8 秒冷却" },
  cultural_temple_bell: { name: "寺钟", trigger: "古寺 (30%)", frequency: "8 秒冷却" },
  cultural_wooden_fish: { name: "木鱼", trigger: "古寺 (10%)", frequency: "8 秒冷却" },
  cultural_crane_call: { name: "鹤鸣", trigger: "鹤实例 < 8u", frequency: "12 秒冷却" }
};

function chineseTrackLabel(id: string): { name: string; trigger: string; frequency: string } {
  return (
    TRACK_LABEL_CN[id] ?? {
      name: id,
      trigger: "—",
      frequency: "—"
    }
  );
}

function renderActiveLayers(activeLayers: AmbientLayerSnapshot[]): string {
  if (activeLayers.length === 0) {
    return '<li class="audio-debug-item audio-debug-empty">无</li>';
  }

  return activeLayers
    .map(({ trackId, currentGain }) => {
      const meta = chineseTrackLabel(trackId);
      return `<li class="audio-debug-item">${escapeHtml(meta.name)} ${formatGainBar(
        currentGain
      )} ${currentGain.toFixed(2)}<br><span class="audio-debug-meta">${escapeHtml(
        meta.trigger
      )} · ${escapeHtml(meta.frequency)}</span></li>`;
    })
    .join("");
}

function renderRecentFires(
  recentFires: FireRecord[],
  nowSec: number
): string {
  if (recentFires.length === 0) {
    return '<li class="audio-debug-item audio-debug-empty">无</li>';
  }

  return recentFires
    .map(({ id, ts }) => {
      const meta = chineseTrackLabel(id);
      const agoSec = Math.max(0, nowSec - ts).toFixed(1);
      return `<li class="audio-debug-item">${agoSec}s 前 · ${escapeHtml(
        meta.name
      )}<br><span class="audio-debug-meta">${escapeHtml(meta.trigger)} · ${escapeHtml(
        meta.frequency
      )}</span></li>`;
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
          <div class="audio-debug-title">持续环境音 · 总音量 ${masterGainValue.toFixed(2)}</div>
          <ul class="audio-debug-list">${renderActiveLayers(activeLayers)}</ul>
        </div>
        <div class="audio-debug-section">
          <div class="audio-debug-title">最近事件音（按 a 关闭面板）</div>
          <ul class="audio-debug-list">${renderRecentFires(recentFires, nowSec)}</ul>
        </div>
      `;
    },
    destroy() {
      element.remove();
    }
  };
}
