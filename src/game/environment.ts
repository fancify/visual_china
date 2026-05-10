import { Color, MathUtils, Vector2, Vector3 } from "three";

import type { SeasonalBlend } from "./biomeZones";
import { celestialCycle } from "./celestial.js";
import type { WindState } from "./windManager";

export type Season = "spring" | "summer" | "autumn" | "winter";
export type Weather = "clear" | "windy" | "rain" | "storm" | "snow" | "mist";
export type WeatherState = Weather;

export interface EnvironmentState {
  timeOfDay: number;
  dayCount: number;
  dayOfYear: number;
  season: Season;
  weather: Weather;
}

export interface WeatherTransition {
  fromState: WeatherState;
  toState: WeatherState;
  startTime: number;
  duration: number;
  progress: number;
}

export interface EnvironmentVisuals {
  skyColor: Color;
  // skyHorizonColor / skyZenithColor 仍保留给 shader 的主渐变。
  // 额外的 cool/warm/ground 则给 dawn-dusk 定向染色和夜晚地平线压暗使用。
  skyHorizonColor: Color;
  skyHorizonCoolColor: Color;
  skySunWarmColor: Color;
  skyZenithColor: Color;
  skyGroundColor: Color;
  skySunInfluence: number;
  twilightStrength: number; // 0..1，朝阳/黄昏强度（sun 在地平线附近达到峰值）
  fogColor: Color;
  ambientColor: Color;
  sunColor: Color;
  moonColor: Color;
  cloudColor: Color;
  rimColor: Color;
  sunDirection: Vector3;
  moonDirection: Vector3;
  ambientIntensity: number;
  sunIntensity: number;
  rimIntensity: number;
  fogDensity: number;
  mistOpacity: number;
  precipitationOpacity: number;
  precipitationColor: Color;
  precipitationSize: number;
  windStrength: number;
  waterShimmer: number;
  daylight: number;
  moonPhase: number;
  starOpacity: number;
  moonOpacity: number;
  sunDiscOpacity: number;
  cloudOpacity: number;
  cloudDriftSpeed: number;
  terrainHueShift: number;
  terrainSaturationMul: number;
  terrainLightnessMul: number;
  seasonalBlend: SeasonalBlend;
}

export function sharedAtmosphericFarColor(
  visuals: Pick<EnvironmentVisuals, "skyHorizonColor">
): Color {
  return visuals.skyHorizonColor.clone();
}

interface SeasonConfig {
  label: string;
  skyDay: string;
  skyNight: string;
  fogDay: string;
  fogNight: string;
  ambient: string;
  sun: string;
  rim: string;
  // 朝阳/黄昏地平线暖色：春夏偏粉橙、秋偏深橙红、冬偏冷粉。
  // sun 在地平线±0.35 之间被混进 sky / fog / sun 颜色。
  twilight: string;
}

interface WeatherConfig {
  label: string;
  wind: number;
  rain: number;
  snow: number;
  fogBoost: number;
  sunCut: number;
  shimmer: number;
}

const seasons: Season[] = ["spring", "summer", "autumn", "winter"];
const weathers: Weather[] = ["clear", "windy", "rain", "storm", "snow", "mist"];
const DAY_OF_YEAR_MAX = 365;
const SYNODIC_MONTH = 29.5;
const SEASON_BLEND_HALF_WINDOW = 16;
const SEASON_BOUNDARIES = {
  spring: 60,
  summer: 152,
  autumn: 244,
  winter: 335
} as const;
const SEASON_CENTERS: Record<Season, number> = {
  spring: 106,
  summer: 198,
  autumn: 289.5,
  winter: 17.5
};

const seasonConfig: Record<Season, SeasonConfig> = {
  spring: {
    label: "春",
    skyDay: "#8eb6ac",
    skyNight: "#112033",
    fogDay: "#8db3a5",
    fogNight: "#0d1822",
    ambient: "#efe0bd",
    sun: "#ffe9b9",
    rim: "#8ab6c3",
    twilight: "#ff8a58"
  },
  summer: {
    label: "夏",
    skyDay: "#89b9b6",
    skyNight: "#0f2031",
    fogDay: "#7aa7a4",
    fogNight: "#0b1720",
    ambient: "#f3e6c2",
    sun: "#fff1ce",
    rim: "#7cb2bf",
    twilight: "#ff7a45"
  },
  autumn: {
    label: "秋",
    skyDay: "#b7a27e",
    skyNight: "#1a2133",
    fogDay: "#b59674",
    fogNight: "#161b28",
    ambient: "#f0dec0",
    sun: "#ffdca2",
    rim: "#a8b4cb",
    twilight: "#ff5e2e"
  },
  winter: {
    label: "冬",
    skyDay: "#9ab0c5",
    skyNight: "#11192a",
    fogDay: "#aab9c9",
    fogNight: "#0c1320",
    ambient: "#dfe7ef",
    sun: "#f7f6ff",
    rim: "#9ec0dd",
    twilight: "#ff8b70"
  }
};

const weatherConfig: Record<Weather, WeatherConfig> = {
  clear: {
    label: "晴",
    wind: 0.28,
    rain: 0,
    snow: 0,
    fogBoost: 0,
    sunCut: 0,
    shimmer: 0.8
  },
  windy: {
    label: "风",
    wind: 0.92,
    rain: 0,
    snow: 0,
    fogBoost: 0.0003,
    sunCut: 0.12,
    shimmer: 0.72
  },
  rain: {
    label: "雨",
    wind: 0.58,
    rain: 1,
    snow: 0,
    fogBoost: 0.0012,
    sunCut: 0.42,
    shimmer: 0.55
  },
  storm: {
    label: "暴",
    wind: 0.98,
    rain: 1,
    snow: 0,
    fogBoost: 0.0023,
    sunCut: 0.68,
    shimmer: 0.34
  },
  snow: {
    label: "雪",
    wind: 0.42,
    rain: 0,
    snow: 1,
    fogBoost: 0.0016,
    sunCut: 0.34,
    shimmer: 0.38
  },
  mist: {
    label: "雾",
    wind: 0.18,
    rain: 0,
    snow: 0,
    fogBoost: 0.0021,
    sunCut: 0.3,
    shimmer: 0.44
  }
};

function dayFactor(timeOfDay: number): number {
  const solar = Math.sin(((timeOfDay - 6) / 24) * Math.PI * 2);
  return MathUtils.smoothstep(solar, -0.08, 0.38);
}

// 地平线上的日/月轮不该在中心刚触到 horizon 时就被压到半透明。
// 现在改成：中心略低于地平线才开始 fade，沉到更低处再完全消失。
export const SKY_BODY_HORIZON_FADE_START = -0.04;
export const SKY_BODY_HORIZON_FADE_END = -0.14;

export function skyBodyHorizonFade(altitude: number): number {
  return MathUtils.smoothstep(
    altitude,
    SKY_BODY_HORIZON_FADE_END,
    SKY_BODY_HORIZON_FADE_START
  );
}

export function sunDiscScaleForAltitude(altitude: number): number {
  return 60 + Math.max(0, altitude) * 18;
}

export function daylightFactor(timeOfDay: number): number {
  return dayFactor(timeOfDay);
}

export function seasonLabel(season: Season): string {
  return seasonConfig[season].label;
}

export function weatherLabel(weather: Weather): string {
  return weatherConfig[weather].label;
}

function normalizedDayOfYear(dayOfYear: number): number {
  return MathUtils.euclideanModulo(dayOfYear, DAY_OF_YEAR_MAX);
}

export function moonPhaseForDayOfYear(dayOfYear: number): number {
  return MathUtils.euclideanModulo(dayOfYear, SYNODIC_MONTH) / SYNODIC_MONTH;
}

export function sunDirectionForTimeOfDay(timeOfDay: number): Vector3 {
  const sunHourAngle = ((timeOfDay - 12) / 24) * Math.PI * 2;
  return new Vector3(
    -Math.sin(sunHourAngle) * 90,
    Math.cos(sunHourAngle) * 150 + 10,
    0
  );
}

function circularBoundaryDelta(dayOfYear: number, boundary: number): number {
  return (
    MathUtils.euclideanModulo(dayOfYear - boundary + DAY_OF_YEAR_MAX * 0.5, DAY_OF_YEAR_MAX) -
    DAY_OF_YEAR_MAX * 0.5
  );
}

export function seasonAtDayOfYear(dayOfYear: number): Season {
  const day = normalizedDayOfYear(dayOfYear);

  if (day >= SEASON_BOUNDARIES.winter || day < SEASON_BOUNDARIES.spring) {
    return "winter";
  }

  if (day < SEASON_BOUNDARIES.summer) {
    return "spring";
  }

  if (day < SEASON_BOUNDARIES.autumn) {
    return "summer";
  }

  return "autumn";
}

export function seasonalBlendAtDayOfYear(dayOfYear: number): SeasonalBlend {
  const day = normalizedDayOfYear(dayOfYear);
  const transitions: Array<{ boundary: number; from: Season; to: Season }> = [
    { boundary: SEASON_BOUNDARIES.spring, from: "winter", to: "spring" },
    { boundary: SEASON_BOUNDARIES.summer, from: "spring", to: "summer" },
    { boundary: SEASON_BOUNDARIES.autumn, from: "summer", to: "autumn" },
    { boundary: SEASON_BOUNDARIES.winter, from: "autumn", to: "winter" }
  ];

  for (const transition of transitions) {
    const delta = circularBoundaryDelta(day, transition.boundary);

    if (Math.abs(delta) <= SEASON_BLEND_HALF_WINDOW) {
      const t = MathUtils.smoothstep(
        delta,
        -SEASON_BLEND_HALF_WINDOW,
        SEASON_BLEND_HALF_WINDOW
      );
      const blend: SeasonalBlend = {
        spring: 0,
        summer: 0,
        autumn: 0,
        winter: 0
      };
      blend[transition.from] = 1 - t;
      blend[transition.to] = t;
      return blend;
    }
  }

  const season = seasonAtDayOfYear(day);
  return {
    spring: season === "spring" ? 1 : 0,
    summer: season === "summer" ? 1 : 0,
    autumn: season === "autumn" ? 1 : 0,
    winter: season === "winter" ? 1 : 0
  };
}

export function formatTimeOfDay(timeOfDay: number): string {
  const hours = Math.floor(timeOfDay);
  const minutes = Math.floor((timeOfDay - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** 古十二时辰映射：每个时辰 2 小时，子时跨午夜。 */
const ANCIENT_HOUR_NAMES = [
  "子", "丑", "寅", "卯", "辰", "巳",
  "午", "未", "申", "酉", "戌", "亥"
] as const;

/**
 * 把 0-24 小时映射成古时辰 + 括号现代时间。
 * 例如 0:30 → "子时 (00:30)"；13:45 → "未时 (13:45)"。
 *
 * 子时跨 23:00–01:00：23 点和 0 点都算子时。
 * (h + 1) % 24 / 2 把"子时中心 0 点"对齐到 index 0：
 *   23 → 0（子）, 0 → 0（子）, 1 → 1（丑）, 2 → 1（丑）, 3 → 2（寅）...
 */
export function formatAncientTimeOfDay(timeOfDay: number): string {
  const hours = Math.floor(timeOfDay);
  const minutes = Math.floor((timeOfDay - hours) * 60);
  const idx = Math.floor(((hours + 1) % 24) / 2);
  const ancientName = ANCIENT_HOUR_NAMES[idx];
  const modern = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
  return `${ancientName}时（${modern}）`;
}

interface EffectiveWeather {
  wind: number;
  rain: number;
  snow: number;
  fogBoost: number;
  sunCut: number;
  shimmer: number;
}

function emptyEffectiveWeather(): EffectiveWeather {
  return { wind: 0, rain: 0, snow: 0, fogBoost: 0, sunCut: 0, shimmer: 0 };
}

function copyWeatherConfig(w: WeatherConfig): EffectiveWeather {
  return {
    wind: w.wind,
    rain: w.rain,
    snow: w.snow,
    fogBoost: w.fogBoost,
    sunCut: w.sunCut,
    shimmer: w.shimmer
  };
}

// 同步过渡：单个 t（0→1，过渡总秒数内走完），所有 channel 用同一个 t 在
// previousWeather 和 targetWeather 间 lerp。codex c66a54e P1 抓到的问题
// 是：用 absolute step 时 sunCut(范围 0.42) 比 rain(范围 1.0) 快 2.4 倍
// 收敛，雨还在但天已经"清"了——视觉上严重不一致。
function blendEffectiveWeather(
  out: EffectiveWeather,
  from: EffectiveWeather,
  to: EffectiveWeather,
  t: number
): void {
  out.wind = from.wind + (to.wind - from.wind) * t;
  out.rain = from.rain + (to.rain - from.rain) * t;
  out.snow = from.snow + (to.snow - from.snow) * t;
  out.fogBoost = from.fogBoost + (to.fogBoost - from.fogBoost) * t;
  out.sunCut = from.sunCut + (to.sunCut - from.sunCut) * t;
  out.shimmer = from.shimmer + (to.shimmer - from.shimmer) * t;
}

export class EnvironmentController {
  private weatherTimer = 0;
  private nextWeatherDelay = 45;
  private elapsedSeconds = 0;
  private transition: WeatherTransition | null = null;
  // 平滑天气切换：保留"过渡前"和"过渡后"两个快照 + 一个 t（0→1，12 秒
  // 内走完）。所有 channel 用同一个 t lerp，避免不同 channel 范围不同导
  // 致收敛速度不同步（codex c66a54e P1 反例：rain 切 clear 时 sunCut 5s
  // 收完了但 rain 还要 12s 才走完）。
  private effectiveWeather: EffectiveWeather = copyWeatherConfig(
    weatherConfig[weathers[0]]
  );
  private weatherTransitionFrom: EffectiveWeather = copyWeatherConfig(
    weatherConfig[weathers[0]]
  );
  private weatherTransitionT = 1;
  private weatherTransitionTarget: Weather = weathers[0];
  private static readonly WEATHER_TRANSITION_SECONDS = 12;
  // 用户："真实世界 20 分钟换一次季节"。
  // 365 days / 4 seasons ≈ 91 days/season; 91 days / 1200 real seconds = 0.076 day/s。
  // 1 整年 = 4 × 20 min = 80 min real time。
  private static readonly DAY_OF_YEAR_ADVANCE_PER_SECOND = 0.076;
  private readonly windDirection = new Vector2(0.86, 0.5).normalize();

  state: EnvironmentState = {
    timeOfDay: 7.5,
    dayCount: 1,
    dayOfYear: 180,
    season: "summer",
    weather: weathers[0]
  };

  private syncSeasonFromDayOfYear(): void {
    this.state.dayOfYear = normalizedDayOfYear(this.state.dayOfYear);
    this.state.season = seasonAtDayOfYear(this.state.dayOfYear);

    if (this.state.season === "winter" && this.state.weather === "rain") {
      this.state.weather = "snow";
    }
  }

  update(deltaSeconds: number): EnvironmentState {
    this.elapsedSeconds += Math.max(0, deltaSeconds);
    const previousTime = this.state.timeOfDay;
    // 用户要求："改半小时一天"——24 game-hour ÷ 1800s = 0.01333
    // game-hour/realSec。1 game-hour ≈ 75s real，比 BotW 还慢一点。
    const nextTime = previousTime + deltaSeconds * 0.01333;
    this.state.timeOfDay = nextTime >= 24 ? nextTime - 24 : nextTime;

    if (nextTime >= 24) {
      this.state.dayCount += 1;
    }

    this.state.dayOfYear = normalizedDayOfYear(
      this.state.dayOfYear +
        deltaSeconds * EnvironmentController.DAY_OF_YEAR_ADVANCE_PER_SECOND
    );
    this.syncSeasonFromDayOfYear();

    this.weatherTimer += deltaSeconds;

    if (this.weatherTimer >= this.nextWeatherDelay) {
      this.weatherTimer = 0;
      this.advanceWeather();
      this.nextWeatherDelay = 36 + Math.random() * 34;
    }

    if (this.transition) {
      this.transition.progress = MathUtils.clamp(
        (this.elapsedSeconds - this.transition.startTime) / this.transition.duration,
        0,
        1
      );
      if (this.transition.progress >= 1) {
        this.state.weather = this.transition.toState;
        this.transition = null;
      }
    }

    // 同步过渡：t 在 12 秒内走完 0→1，所有 channel 用同一个 t lerp。
    // 每次 weather 切换 t reset 为 0：每段 blend 严格 12s 走完。
    // 中途被打断（rare，~36-70s 才自动切一次，K 键手动也罕见）会让
    // 总时间超过 12s（worst case 24s 来回），但每段 blend 时长可预期
    // —— 这比 mid-flight 距离 proxy 既要保证 12s blend 又要避免 dry-to-
    // dry 跳过的两难简单可控。
    const effectiveWeatherTarget = this.transition?.toState ?? this.state.weather;
    if (this.weatherTransitionTarget !== effectiveWeatherTarget) {
      this.weatherTransitionFrom = { ...this.effectiveWeather };
      this.weatherTransitionTarget = effectiveWeatherTarget;
      this.weatherTransitionT = 0;
    }
    if (this.weatherTransitionT < 1) {
      this.weatherTransitionT = Math.min(
        1,
        this.weatherTransitionT +
          deltaSeconds / EnvironmentController.WEATHER_TRANSITION_SECONDS
      );
      const target = copyWeatherConfig(weatherConfig[this.weatherTransitionTarget]);
      blendEffectiveWeather(
        this.effectiveWeather,
        this.weatherTransitionFrom,
        target,
        this.weatherTransitionT
      );
    }

    return this.state;
  }

  getWindState(): WindState {
    const wind = this.effectiveWeather.wind;
    const gustPulse =
      Math.sin(this.weatherTimer * 0.72) * 0.5 +
      Math.sin(this.weatherTimer * 1.37 + 1.8) * 0.5;
    const gust = MathUtils.smoothstep(gustPulse, 0.48, 0.98) * Math.max(0, wind - 0.35);

    return {
      direction: this.windDirection,
      wind,
      gust
    };
  }

  advanceSeason(): void {
    const nextSeason = seasons[(seasons.indexOf(this.state.season) + 1) % seasons.length]!;
    this.state.dayOfYear = SEASON_CENTERS[nextSeason];
    this.syncSeasonFromDayOfYear();
  }

  setWeather(target: WeatherState, durationSec = 12): void {
    const normalizedTarget =
      this.state.season === "winter" && target === "rain" ? "snow" : target;
    if (this.state.weather === normalizedTarget && !this.transition) {
      return;
    }
    if (this.transition?.toState === normalizedTarget) {
      return;
    }
    if (durationSec <= 0) {
      this.state.weather = normalizedTarget;
      this.transition = null;
      return;
    }
    this.transition = {
      fromState: this.state.weather,
      toState: normalizedTarget,
      startTime: this.elapsedSeconds,
      duration: durationSec,
      progress: 0
    };
  }

  advanceWeather(): void {
    const options =
      this.state.season === "winter"
        ? (["clear", "windy", "mist", "snow"] as Weather[])
        : this.state.season === "summer"
          ? (["clear", "windy", "rain", "storm", "mist"] as Weather[])
          : (["clear", "windy", "rain", "storm", "mist"] as Weather[]);

    const currentWeather = this.transition?.toState ?? this.state.weather;
    const currentIndex = options.indexOf(currentWeather);
    const nextIndex =
      (currentIndex + 1 + Math.floor(Math.random() * (options.length - 1))) %
      options.length;
    this.setWeather(options[nextIndex]!);
  }

  getWeatherTransitionLerp(): { from: WeatherState; to: WeatherState; t: number } | null {
    if (!this.transition) {
      return null;
    }
    return {
      from: this.transition.fromState,
      to: this.transition.toState,
      t: this.transition.progress
    };
  }

  computeVisuals(): EnvironmentVisuals {
    this.syncSeasonFromDayOfYear();
    const seasonalBlend = seasonalBlendAtDayOfYear(this.state.dayOfYear);
    const season = seasonConfig[this.state.season];
    // 用 effectiveWeather 而不是 weatherConfig[state.weather]：保证天气
    // 切换时 sunCut/rain/snow/fogBoost/shimmer 都是平滑过渡的，雨/雾/云
    // 不会一帧跳变。
    const weather = this.effectiveWeather;
    const celestial = celestialCycle({
      timeOfDay: this.state.timeOfDay,
      weatherSunCut: weather.sunCut,
      fogBoost: weather.fogBoost,
      windStrength: weather.wind
    });
    const daylight = celestial.daylight;
    const moonPhase = moonPhaseForDayOfYear(this.state.dayOfYear);
    const solar = Math.sin(((this.state.timeOfDay - 6) / 24) * Math.PI * 2);
    const nightReadableSky = new Color(season.skyNight).lerp(
      new Color("#314648"),
      celestial.nightReadability * 0.34
    );
    const nightHorizonBase = new Color(season.fogNight)
      .lerp(new Color("#18232f"), celestial.nightReadability * 0.16)
      .multiplyScalar(0.82);
    const dayHorizonBase = new Color(season.skyDay);
    const dayZenithBase = new Color(season.skyDay)
      .multiplyScalar(0.62)
      .offsetHSL(0.012, -0.05, -0.04);
    const skyColor = nightReadableSky.clone().lerp(dayHorizonBase, daylight);
    const fogColor = new Color(season.fogNight)
      .lerp(new Color("#49645e"), celestial.nightReadability * 0.35)
      .lerp(new Color(season.fogDay), daylight);
    const ambientColor = new Color(season.ambient).multiplyScalar(
      MathUtils.lerp(celestial.nightReadability, 1, daylight)
    );
    const sunColor = new Color(season.sun).lerp(new Color("#cfd8ef"), 1 - daylight);

    // 朝阳 / 黄昏：solar 接近 0 时（太阳在地平线附近）twilightStrength 高。
    // 死区窗口拉到 [0.02, 0.42]，太阳越近地平线效果越浓。
    const twilightStrength = MathUtils.clamp(
      1 - MathUtils.smoothstep(Math.abs(solar), 0.02, 0.42),
      0,
      1
    );
    const sunDiscOpacity = MathUtils.clamp(
      (MathUtils.clamp(daylight, 0, 1) + twilightStrength * 0.4) * (1 - weather.sunCut * 0.5),
      0,
      1
    );
    const twilightColor = new Color(season.twilight).lerp(new Color("#ff5e2e"), 0.32);
    const skyHorizonColor = nightHorizonBase.clone().lerp(dayHorizonBase, daylight);
    // seasonal palette 默认切到夏季后，base horizon 的红量略低于旧春季默认，
    // 需要把 twilight 暖色轻微灌回主 horizon ramp，才能保持 dusk 时地平线
    // 比 zenith 更暖，也让 renderer clearColor / 远山边缘过渡更一致。
    skyHorizonColor.lerp(twilightColor, twilightStrength * 0.28);
    const skyZenithColor = nightReadableSky
      .clone()
      .lerp(dayZenithBase, daylight)
      .lerp(new Color("#2c3a55"), twilightStrength * 0.7);
    const skyHorizonCoolColor =
      twilightStrength <= 0
        ? skyHorizonColor.clone()
        : skyZenithColor
            .clone()
            // 背阳侧冷边不该从更亮的 horizon ramp 派生，否则 twilight 时容易
            // 比 zenith 还亮。只在 dawn/dusk 时从 zenith 色出发叠少量冷蓝。
            .lerp(new Color("#4d6284"), twilightStrength * 0.08)
            .multiplyScalar(MathUtils.lerp(1, 0.76, twilightStrength * 0.9));
    const skySunWarmColor = skyHorizonColor
      .clone()
      .lerp(twilightColor, MathUtils.lerp(0.78, 0.98, twilightStrength));
    const skyGroundColor =
      daylight > 0.28
        ? skyHorizonColor.clone().multiplyScalar(0.18)
        : new Color("#06080c").lerp(skyHorizonColor, daylight * 0.28);
    fogColor.lerp(twilightColor, twilightStrength * 0.5);
    sunColor.lerp(twilightColor, twilightStrength * 0.9);
    // skyColor 本身也被推一点暖色——renderer.setClearColor 用它，
    // sky dome 视野以外的"留白"也跟着 dawn/dusk 一起变暖。
    skyColor.lerp(twilightColor, twilightStrength * 0.28);
    const moonColor = new Color("#dce7ff").lerp(new Color("#fff2d0"), daylight * 0.18);
    const cloudColor = new Color("#d7d2ad").lerp(new Color("#f4ead0"), daylight);
    const rimColor = new Color(season.rim).multiplyScalar(MathUtils.lerp(0.5, 1, daylight));
    const sunDirection = sunDirectionForTimeOfDay(this.state.timeOfDay);
    const moonDirection = sunDirection.clone().multiplyScalar(-0.74);
    moonDirection.y = Math.max(28, -sunDirection.y + 48);

    return {
      skyColor,
      skyHorizonColor,
      skyHorizonCoolColor,
      skySunWarmColor,
      skyZenithColor,
      skyGroundColor,
      skySunInfluence: twilightStrength,
      twilightStrength,
      fogColor,
      ambientColor,
      sunColor,
      moonColor,
      cloudColor,
      rimColor,
      sunDirection,
      moonDirection,
      ambientIntensity: MathUtils.lerp(1.18, 1.75, daylight),
      sunIntensity: MathUtils.lerp(0.1, 2.9, daylight) * (1 - weather.sunCut),
      rimIntensity: MathUtils.lerp(0.25, 0.82, daylight),
      // fogDensity 砍半（用户："看不到地形"）——之前 0.003-0.0075 范围
      // 在 cameraDistance 170 overview 视角下让 200 单元远的地形 76% 失彩，
      // 整图灰蒙。FogExp2 衰减 = exp(-density² × distance²)，density 减半
      // 同距离 fog factor 从 ~0.24 → ~0.7（保留 70% 原色）。
      fogDensity: MathUtils.lerp(0.0036, 0.0016, daylight) + weather.fogBoost * 0.55,
      mistOpacity: MathUtils.lerp(0.012, 0.055, 1 - daylight) + weather.fogBoost * 9,
      // 粒子透明度 / 颜色 / 尺寸 现在按 rain / snow 的连续混合算，
      // 让"晴 → 雨"过渡里粒子能从无到有平滑显现，而不是瞬间满。
      precipitationOpacity: weather.rain * 0.6 + weather.snow * 0.42,
      precipitationColor: new Color("#9fc7d8").lerp(
        new Color("#f7fbff"),
        MathUtils.clamp(weather.snow, 0, 1)
      ),
      precipitationSize: 0.18 + (0.42 - 0.18) * MathUtils.clamp(weather.snow, 0, 1),
      windStrength: weather.wind,
      waterShimmer: weather.shimmer * MathUtils.lerp(0.35, 1, daylight),
      daylight,
      moonPhase,
      starOpacity: celestial.starOpacity,
      moonOpacity: celestial.moonOpacity,
      sunDiscOpacity,
      cloudOpacity: celestial.cloudOpacity,
      cloudDriftSpeed: celestial.cloudDriftSpeed,
      terrainHueShift:
        seasonalBlend.spring * 0.015 +
        seasonalBlend.summer * 0.03 +
        seasonalBlend.autumn * -0.018 +
        seasonalBlend.winter * -0.01,
      // terrain mult 改成基于 effectiveWeather 的连续混合，让天气过渡也
      // 平滑——硬开关会让山色一帧跳一次。
      // 基线 = season-based。雨/雪/雾按各自强度往各自的目标拉。
      terrainSaturationMul: (() => {
        const seasonBase =
          seasonalBlend.spring * 1 +
          seasonalBlend.summer * 1.08 +
          seasonalBlend.autumn * 1 +
          seasonalBlend.winter * 0.82;
        const mistFactor = MathUtils.clamp(weather.fogBoost / 0.0021, 0, 1);
        let mul = MathUtils.lerp(seasonBase, 0.8, mistFactor * 0.6);
        mul = MathUtils.lerp(mul, 0.72, MathUtils.clamp(weather.snow, 0, 1) * 0.7);
        mul = MathUtils.lerp(mul, 0.88, MathUtils.clamp(weather.rain, 0, 1) * 0.6);
        return mul;
      })(),
      terrainLightnessMul: (() => {
        const dayBase = MathUtils.lerp(celestial.terrainLightnessFloor, 1.06, daylight);
        const mistFactor = MathUtils.clamp(weather.fogBoost / 0.0021, 0, 1);
        let mul = MathUtils.lerp(dayBase, 0.96, mistFactor * 0.5);
        mul = MathUtils.lerp(mul, 0.92, MathUtils.clamp(weather.rain, 0, 1) * 0.5);
        mul = MathUtils.lerp(mul, 1.14, MathUtils.clamp(weather.snow, 0, 1) * 0.6);
        return mul;
      })(),
      seasonalBlend
    };
  }
}
