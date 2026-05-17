// DebugPanel.ts — 反引号唤起的浮动 debug 面板。
//
// 设计 spec: docs/superpowers/specs/2026-05-15-control-scheme-redesign-design.md
// 偏好备忘: simple-debug-panel — toggle/slider only，无文字命令。

import type { Season, Weather } from "../environment.js";
import type { TerrainStyleName } from "../terrain/terrainStyle.js";

export interface DebugPanelHandlers {
  onFlatShadingToggle?: (active: boolean) => void;
  onLodTintToggle?: (active: boolean) => void;
  onOverlayToggle?: (active: boolean) => void;
  onBeachTintToggle?: (active: boolean) => void;
  onTimeChange?: (hour: number) => void;
  onWeatherChange?: (weather: Weather) => void;
  onSeasonChange?: (season: Season) => void;
  /** 人物相对 mount 的高度偏移调试 */
  onGroundOffsetChange?: (value: number) => void;
  onSwordOffsetChange?: (value: number) => void;
  onCloudOffsetChange?: (value: number) => void;
  /** 当前各 offset 初值，用于 slider 默认位置 */
  initialMountOffsets?: { ground: number; sword: number; cloud: number };
  /** 地形风格切换 */
  onTerrainStyleChange?: (style: TerrainStyleName) => void;
  /** 角色自发光强度（夜里最低可视度） */
  onCharacterEmissiveChange?: (value: number) => void;
  initialCharacterEmissive?: number;
  getStats?: () => {
    fps: number;
    chunks: number;
    timeOfDay: number;
    weather: Weather;
    season: Season;
    player?: string;
    playerWorld?: string;
    cameraWorld?: string;
    nearbyPoi?: string;
    message?: string;
  };
}

export interface DebugPanel {
  setVisible(visible: boolean): void;
  toggle(): boolean;
  isVisible(): boolean;
  setFlatShading(active: boolean): void;
  setLodTint(active: boolean): void;
  setOverlay(active: boolean): void;
  setBeachTint(active: boolean): void;
  /** drive FPS / stats display, call once per ~10 frames. */
  refreshStats(): void;
  dispose(): void;
}

const PANEL_STYLE = `
  position: fixed;
  top: 56px;
  right: 16px;
  z-index: 9999;
  width: 260px;
  font: 12px/1.5 -apple-system, BlinkMacSystemFont, "PingFang SC", monospace;
  color: #e7e4d8;
  background: rgba(20, 22, 28, 0.92);
  border: 1px solid rgba(255, 215, 130, 0.25);
  border-radius: 6px;
  padding: 12px 14px;
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.4);
  display: none;
  user-select: none;
`;

const ROW_STYLE = "display: flex; align-items: center; justify-content: space-between; margin: 6px 0; gap: 8px;";
const LABEL_STYLE = "color: #b3aa92; font-size: 11px; letter-spacing: 0.4px;";
const VALUE_STYLE = "color: #ffd782; font-variant-numeric: tabular-nums;";
const HEADER_STYLE = "color: #ffd782; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; border-bottom: 1px solid rgba(255, 215, 130, 0.2); padding-bottom: 4px; margin-bottom: 8px;";
const HINT_STYLE = "color: #7a6f56; font-size: 10px; margin-top: 10px; padding-top: 8px; border-top: 1px solid rgba(255, 255, 255, 0.05);";

const WEATHERS: Weather[] = ["clear", "windy", "cloudy", "rain", "storm", "snow", "mist"];
const SEASONS: Season[] = ["spring", "summer", "autumn", "winter"];

function makeCheckbox(label: string, initial: boolean, onChange: (active: boolean) => void): {
  row: HTMLDivElement;
  set: (v: boolean) => void;
} {
  const row = document.createElement("div");
  row.style.cssText = ROW_STYLE;
  const labelEl = document.createElement("span");
  labelEl.style.cssText = LABEL_STYLE;
  labelEl.textContent = label;
  const input = document.createElement("input");
  input.type = "checkbox";
  input.checked = initial;
  input.style.cssText = "accent-color: #ffd782; cursor: pointer;";
  input.addEventListener("change", () => onChange(input.checked));
  row.append(labelEl, input);
  return { row, set: (v) => { input.checked = v; } };
}

function makeSlider(label: string, min: number, max: number, step: number, initial: number, format: (v: number) => string, onChange: (v: number) => void): HTMLDivElement {
  const wrap = document.createElement("div");
  wrap.style.cssText = "margin: 8px 0;";
  const head = document.createElement("div");
  head.style.cssText = ROW_STYLE + "margin: 0 0 4px 0;";
  const labelEl = document.createElement("span");
  labelEl.style.cssText = LABEL_STYLE;
  labelEl.textContent = label;
  const valueEl = document.createElement("span");
  valueEl.style.cssText = VALUE_STYLE;
  valueEl.textContent = format(initial);
  head.append(labelEl, valueEl);

  const slider = document.createElement("input");
  slider.type = "range";
  slider.min = String(min);
  slider.max = String(max);
  slider.step = String(step);
  slider.value = String(initial);
  slider.style.cssText = "width: 100%; accent-color: #ffd782; cursor: pointer;";
  slider.addEventListener("input", () => {
    const v = Number(slider.value);
    valueEl.textContent = format(v);
    onChange(v);
  });

  wrap.append(head, slider);
  return wrap;
}

function makeDropdown<T extends string>(label: string, options: T[], initial: T, onChange: (v: T) => void): HTMLDivElement {
  const row = document.createElement("div");
  row.style.cssText = ROW_STYLE;
  const labelEl = document.createElement("span");
  labelEl.style.cssText = LABEL_STYLE;
  labelEl.textContent = label;
  const select = document.createElement("select");
  select.style.cssText = "background: rgba(0,0,0,0.4); color: #e7e4d8; border: 1px solid rgba(255,215,130,0.3); border-radius: 3px; padding: 2px 6px; font: inherit; cursor: pointer;";
  for (const opt of options) {
    const o = document.createElement("option");
    o.value = opt;
    o.textContent = opt;
    if (opt === initial) o.selected = true;
    select.append(o);
  }
  select.addEventListener("change", () => onChange(select.value as T));
  row.append(labelEl, select);
  return row;
}

function makeStatRow(label: string): { row: HTMLDivElement; value: HTMLSpanElement } {
  const row = document.createElement("div");
  row.style.cssText = ROW_STYLE;
  const labelEl = document.createElement("span");
  labelEl.style.cssText = LABEL_STYLE;
  labelEl.textContent = label;
  const value = document.createElement("span");
  value.style.cssText = VALUE_STYLE + "text-align: right; overflow-wrap: anywhere;";
  value.textContent = "—";
  row.append(labelEl, value);
  return { row, value };
}

export function createDebugPanel(handlers: DebugPanelHandlers): DebugPanel {
  const root = document.createElement("div");
  root.style.cssText = PANEL_STYLE;
  root.dataset.debug = "panel";

  const header = document.createElement("div");
  header.style.cssText = HEADER_STYLE;
  header.textContent = "调试面板 · \\` 关";
  root.append(header);

  // ── Visual toggles ─────────────────────────────────────────────
  const flatShading = makeCheckbox("Flat shading", false, (v) => handlers.onFlatShadingToggle?.(v));
  const lodTint    = makeCheckbox("LOD tint",      false, (v) => handlers.onLodTintToggle?.(v));
  const overlay    = makeCheckbox("Debug overlay", false, (v) => handlers.onOverlayToggle?.(v));
  const beachTint  = makeCheckbox("Beach tint",    true,  (v) => handlers.onBeachTintToggle?.(v));
  const TERRAIN_STYLES: TerrainStyleName[] = ["qinglu", "ink", "botw"];
  const styleSel = makeDropdown<TerrainStyleName>("Terrain style", TERRAIN_STYLES, "qinglu", (v) => handlers.onTerrainStyleChange?.(v));
  root.append(flatShading.row, lodTint.row, overlay.row, beachTint.row, styleSel);

  // ── Environment ────────────────────────────────────────────────
  const envHeader = document.createElement("div");
  envHeader.style.cssText = HEADER_STYLE + "margin-top: 10px;";
  envHeader.textContent = "环境";
  root.append(envHeader);

  const initial = handlers.getStats?.() ?? { fps: 0, chunks: 0, timeOfDay: 12, weather: "clear" as Weather, season: "spring" as Season };

  const timeSlider = makeSlider("Time", 0, 24, 0.5, initial.timeOfDay,
    (v) => `${Math.floor(v).toString().padStart(2, "0")}:${Math.floor((v % 1) * 60).toString().padStart(2, "0")}`,
    (v) => handlers.onTimeChange?.(v)
  );
  root.append(timeSlider);

  const weatherSel = makeDropdown<Weather>("Weather", WEATHERS, initial.weather, (v) => handlers.onWeatherChange?.(v));
  const seasonSel  = makeDropdown<Season>("Season",  SEASONS,  initial.season,  (v) => handlers.onSeasonChange?.(v));
  root.append(weatherSel, seasonSel);

  // ── Mount offsets (人 vs 地面/剑/云高度) ───────────────────────────
  const offsetsHeader = document.createElement("div");
  offsetsHeader.style.cssText = HEADER_STYLE + "margin-top: 10px;";
  offsetsHeader.textContent = "人物高度";
  root.append(offsetsHeader);

  const mountInit = handlers.initialMountOffsets ?? { ground: -0.04, sword: 0.27, cloud: 0.19 };
  // step 0.001 = 1mm 精度；range 收紧到 ±0.5m 让拖一格更小
  const groundSlider = makeSlider("Ground offset", -0.3, 0.3, 0.001, mountInit.ground,
    (v) => v.toFixed(3) + "m",
    (v) => handlers.onGroundOffsetChange?.(v)
  );
  const swordSlider = makeSlider("Sword offset",  -0.3, 0.6, 0.001, mountInit.sword,
    (v) => v.toFixed(3) + "m",
    (v) => handlers.onSwordOffsetChange?.(v)
  );
  const cloudSlider = makeSlider("Cloud offset",  -0.3, 0.6, 0.001, mountInit.cloud,
    (v) => v.toFixed(3) + "m",
    (v) => handlers.onCloudOffsetChange?.(v)
  );
  const emissiveSlider = makeSlider("Char emissive", 0, 1, 0.01, handlers.initialCharacterEmissive ?? 0.2,
    (v) => v.toFixed(2),
    (v) => handlers.onCharacterEmissiveChange?.(v)
  );
  root.append(groundSlider, swordSlider, cloudSlider, emissiveSlider);

  // ── Stats ──────────────────────────────────────────────────────
  const statsHeader = document.createElement("div");
  statsHeader.style.cssText = HEADER_STYLE + "margin-top: 10px;";
  statsHeader.textContent = "状态";
  root.append(statsHeader);

  const fps = makeStatRow("FPS");
  const chunks = makeStatRow("Chunks");
  const playerState = makeStatRow("玩家");
  const playerWorld = makeStatRow("玩家坐标");
  const cameraWorld = makeStatRow("相机坐标");
  const environment = makeStatRow("环境");
  const nearbyPoi = makeStatRow("附近 POI");
  const message = makeStatRow("消息");

  root.append(
    fps.row,
    chunks.row,
    playerState.row,
    playerWorld.row,
    cameraWorld.row,
    environment.row,
    nearbyPoi.row,
    message.row
  );

  // ── Hint ───────────────────────────────────────────────────────
  const hint = document.createElement("div");
  hint.style.cssText = HINT_STYLE;
  hint.innerHTML = "WASD 镜头相对移动 · 左/右键拖镜头<br/>Shift 加速 · Space/Ctrl 升降 · P 切坐骑<br/>F 复位镜头 · T/L/K 时间/季节/天气 · M 地图 · I POI";
  root.append(hint);

  document.body.append(root);

  let visible = false;

  return {
    setVisible(v) {
      visible = v;
      root.style.display = v ? "block" : "none";
    },
    toggle() {
      visible = !visible;
      root.style.display = visible ? "block" : "none";
      return visible;
    },
    isVisible() {
      return visible;
    },
    setFlatShading(v) { flatShading.set(v); },
    setLodTint(v) { lodTint.set(v); },
    setOverlay(v) { overlay.set(v); },
    setBeachTint(v) { beachTint.set(v); },
    refreshStats() {
      const stats = handlers.getStats?.();
      if (!stats) return;
      fps.value.textContent = stats.fps.toFixed(0);
      chunks.value.textContent = String(stats.chunks);
      playerState.value.textContent = stats.player ?? "—";
      playerWorld.value.textContent = stats.playerWorld ?? "—";
      cameraWorld.value.textContent = stats.cameraWorld ?? "—";
      environment.value.textContent = `${stats.timeOfDay.toFixed(1)}h · ${stats.season} · ${stats.weather}`;
      nearbyPoi.value.textContent = stats.nearbyPoi ?? "—";
      message.value.textContent = stats.message ?? "—";
    },
    dispose() {
      root.remove();
    }
  };
}
