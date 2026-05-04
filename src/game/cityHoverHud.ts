import type { RealCity } from "../data/realCities.js";
import type {
  QinlingAncientSite,
  QinlingScenicLandmark
} from "./qinlingAtlas.js";
import type { StoryBeat } from "./storyGuide";

export interface CityHoverCardState {
  city: RealCity;
  elevationMeters: number;
  zone: string;
  beat: StoryBeat | null;
}

export type HoverPoiCategory = "scenic" | "ancient";

export type HoverPoi = QinlingScenicLandmark | QinlingAncientSite;

export interface PoiHoverCardState {
  poi: HoverPoi;
  category: HoverPoiCategory;
  elevationMeters: number;
  zone: string;
}

export type HudState = "hidden" | "compact" | "detail";
export type PoiCategory = "city" | "scenic" | "ancient" | "pass";
export type HudSource = "hover" | "proximity";

export interface PoiInfo {
  id: string;
  name: string;
  category: PoiCategory;
  worldX: number;
  worldZ: number;
  elevation: number;
  realLat: number;
  realLon: number;
  description?: string;
}

export interface HudUpdate {
  target: PoiInfo | null;
  source: HudSource | null;
  state: HudState;
}

export interface CityHoverHud {
  setTarget(target: PoiInfo | null, source: HudSource | null): void;
  toggleDetail(): void;
  hide(): void;
  getCurrentState(): HudState;
  getCurrentTargetId(): string | null;
}

interface CreateCityHoverHudOptions {
  getPlayerWorldPosition: () => { x: number; z: number } | null;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function truncateHoverText(value: string, maxLength = 100): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function cityTierLabel(tier: RealCity["tier"]): string {
  if (tier === "capital") {
    return "京城";
  }
  if (tier === "prefecture") {
    return "州府";
  }
  return "县城";
}

export function poiCategoryLabel(category: PoiCategory): string {
  if (category === "city") {
    return "城市";
  }
  if (category === "scenic") {
    return "名胜";
  }
  if (category === "pass") {
    return "关隘";
  }
  return "考古";
}

function poiCategoryDetailLabel(category: PoiCategory): string {
  if (category === "city") {
    return "城市聚落";
  }
  if (category === "scenic") {
    return "自然景观";
  }
  if (category === "pass") {
    return "关隘要塞";
  }
  return "古迹遗址";
}

export function findStoryBeatForZone(
  storyBeats: StoryBeat[],
  zone: string,
  resolveBeatZone: (beat: StoryBeat) => string
): StoryBeat | null {
  return storyBeats.find((beat) => resolveBeatZone(beat) === zone) ?? null;
}

function formatLatitude(lat: number, digits = 4): string {
  return `${Math.abs(lat).toFixed(digits)}°${lat >= 0 ? "N" : "S"}`;
}

function formatLongitude(lon: number, digits = 4): string {
  return `${Math.abs(lon).toFixed(digits)}°${lon >= 0 ? "E" : "W"}`;
}

function formatDistanceKm(distance: number): string {
  return `${distance.toFixed(1)} km`;
}

export function defaultPoiDescription(poi: PoiInfo): string {
  return poi.description ?? `${poiCategoryLabel(poi.category)} · ${poi.name} 是该区域的代表性地标。`;
}

export function createInitialHudUpdate(): HudUpdate {
  return {
    target: null,
    source: null,
    state: "hidden"
  };
}

export function resolveHudTargetSource(
  hoverTarget: PoiInfo | null,
  proximityTarget: PoiInfo | null
): HudUpdate {
  const target = hoverTarget ?? proximityTarget;
  return {
    target,
    source: hoverTarget ? "hover" : (proximityTarget ? "proximity" : null),
    state: target ? "compact" : "hidden"
  };
}

export function reduceHudTarget(
  current: HudUpdate,
  target: PoiInfo | null,
  source: HudSource | null
): HudUpdate {
  if (!target || !source) {
    return createInitialHudUpdate();
  }

  if (current.target?.id === target.id) {
    const nextState =
      current.state === "hidden" || current.source !== source ? "compact" : current.state;
    return {
      target,
      source,
      state: nextState
    };
  }

  return {
    target,
    source,
    state: "compact"
  };
}

export function toggleHudDetailState(current: HudUpdate): HudUpdate {
  if (current.state === "hidden" || !current.target || !current.source) {
    return current;
  }

  return {
    ...current,
    state: current.state === "detail" ? "compact" : "detail"
  };
}

export function findNearestProximityPoi(
  playerX: number,
  playerZ: number,
  pois: PoiInfo[],
  resolveRadius: (poi: PoiInfo) => number
): PoiInfo | null {
  let nearest: PoiInfo | null = null;
  let nearestDistance = Infinity;

  for (const poi of pois) {
    const dx = poi.worldX - playerX;
    const dz = poi.worldZ - playerZ;
    const distance = Math.hypot(dx, dz);
    const radius = resolveRadius(poi);
    if (distance <= radius && distance < nearestDistance) {
      nearest = poi;
      nearestDistance = distance;
    }
  }

  return nearest;
}

function buildCompactHudHtml(target: PoiInfo): string {
  return `
    <div class="hud-hover-card-title">${escapeHtml(target.name)}</div>
    <div class="hud-hover-card-elevation">海拔 ${Math.round(target.elevation)} m</div>
    <div class="hud-hover-card-hint">按 i 查看详情 <span aria-hidden="true">ⓘ</span></div>
  `;
}

function buildDetailHudHtml(
  target: PoiInfo,
  getPlayerWorldPosition: () => { x: number; z: number } | null
): string {
  const playerPosition = getPlayerWorldPosition();
  const distanceKm = playerPosition
    ? Math.hypot(target.worldX - playerPosition.x, target.worldZ - playerPosition.z)
    : null;

  return `
    <div class="hud-hover-card-title">${escapeHtml(target.name)}</div>
    <div class="hud-hover-card-divider" aria-hidden="true"></div>
    <div class="hud-hover-card-row"><span>类型</span><strong>${escapeHtml(
      poiCategoryDetailLabel(target.category)
    )}</strong></div>
    <div class="hud-hover-card-row"><span>海拔</span><strong>${Math.round(
      target.elevation
    )} m</strong></div>
    <div class="hud-hover-card-row"><span>坐标</span><strong>${formatLatitude(
      target.realLat,
      2
    )}, ${formatLongitude(target.realLon, 2)}</strong></div>
    ${
      distanceKm === null
        ? ""
        : `<div class="hud-hover-card-row"><span>距离</span><strong>${formatDistanceKm(
            distanceKm
          )}</strong></div>`
    }
    <div class="hud-hover-card-divider" aria-hidden="true"></div>
    <p>${escapeHtml(defaultPoiDescription(target))}</p>
    <div class="hud-hover-card-divider" aria-hidden="true"></div>
    <div class="hud-hover-card-hint hud-hover-card-hint-detail">按 i 收起</div>
  `;
}

function renderHudHtml(
  update: HudUpdate,
  getPlayerWorldPosition: () => { x: number; z: number } | null
): string {
  if (!update.target || update.state === "hidden") {
    return "";
  }

  return update.state === "detail"
    ? buildDetailHudHtml(update.target, getPlayerWorldPosition)
    : buildCompactHudHtml(update.target);
}

export function createCityHoverHud(
  parent: HTMLElement,
  options: CreateCityHoverHudOptions
): CityHoverHud {
  const hoverCard = document.createElement("div");
  hoverCard.id = "hud-hover-card";
  hoverCard.className = "hud-hover-card hud-hover-card-hidden";
  parent.appendChild(hoverCard);

  let current = createInitialHudUpdate();

  function sync(): void {
    hoverCard.classList.toggle("hud-hover-card-hidden", current.state === "hidden");
    hoverCard.classList.toggle("hud-hover-card-compact", current.state === "compact");
    hoverCard.classList.toggle("hud-hover-card-detail", current.state === "detail");
    hoverCard.dataset.source = current.source ?? "";
    hoverCard.innerHTML = renderHudHtml(current, options.getPlayerWorldPosition);
  }

  sync();

  return {
    setTarget(target, source) {
      current = reduceHudTarget(current, target, source);
      sync();
    },
    toggleDetail() {
      current = toggleHudDetailState(current);
      sync();
    },
    hide() {
      current = createInitialHudUpdate();
      sync();
    },
    getCurrentState() {
      return current.state;
    },
    getCurrentTargetId() {
      return current.target?.id ?? null;
    }
  };
}

export function buildCityHoverCardHtml({
  city,
  elevationMeters,
  zone,
  beat
}: CityHoverCardState): string {
  const detail = city.description || city.hint || "暂无补充说明。";
  const summary = truncateHoverText(detail, 100);
  const beatHtml = beat
    ? `
        <div class="hud-hover-card-story">
          <div class="hud-hover-card-section">主线</div>
          <strong>${escapeHtml(beat.title)}</strong>
          <p>${escapeHtml(truncateHoverText(beat.guidance, 110))}</p>
        </div>
      `
    : "";

  return `
    <div class="hud-hover-card-kicker">${escapeHtml(cityTierLabel(city.tier))} · ${escapeHtml(
      city.tier
    )}</div>
    <strong>${escapeHtml(city.name)}</strong>
    <div class="hud-hover-card-meta">地带：${escapeHtml(zone)}</div>
    <div class="hud-hover-card-meta">海拔：${elevationMeters} m</div>
    <div class="hud-hover-card-meta">坐标：${formatLatitude(city.lat)}, ${formatLongitude(city.lon)}</div>
    <p>${escapeHtml(summary)}</p>
    ${beatHtml}
  `;
}

export function buildPoiHoverCardHtml({
  poi,
  category,
  elevationMeters,
  zone
}: PoiHoverCardState): string {
  const summary = truncateHoverText(poi.summary || "暂无补充说明。", 110);

  return `
    <div class="hud-hover-card-kicker">${escapeHtml(poiCategoryLabel(category))}</div>
    <strong>${escapeHtml(poi.name)}</strong>
    <div class="hud-hover-card-meta">地带：${escapeHtml(zone)}</div>
    <div class="hud-hover-card-meta">海拔：${elevationMeters} m</div>
    <div class="hud-hover-card-meta">坐标：${formatLatitude(poi.lat)}, ${formatLongitude(poi.lon)}</div>
    <p>${escapeHtml(summary)}</p>
  `;
}
