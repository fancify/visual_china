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

export function poiCategoryLabel(category: HoverPoiCategory): string {
  return category === "scenic" ? "名胜" : "考古";
}

export function findStoryBeatForZone(
  storyBeats: StoryBeat[],
  zone: string,
  resolveBeatZone: (beat: StoryBeat) => string
): StoryBeat | null {
  return storyBeats.find((beat) => resolveBeatZone(beat) === zone) ?? null;
}

function formatLatitude(lat: number): string {
  return `${Math.abs(lat).toFixed(4)}°${lat >= 0 ? "N" : "S"}`;
}

function formatLongitude(lon: number): string {
  return `${Math.abs(lon).toFixed(4)}°${lon >= 0 ? "E" : "W"}`;
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
