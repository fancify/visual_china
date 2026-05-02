import { Color, MathUtils, Vector3 } from "three";

import { celestialCycle } from "./celestial.js";

export type Season = "spring" | "summer" | "autumn" | "winter";
export type Weather = "clear" | "windy" | "rain" | "snow" | "mist";

export interface EnvironmentState {
  timeOfDay: number;
  dayCount: number;
  season: Season;
  weather: Weather;
}

export interface EnvironmentVisuals {
  skyColor: Color;
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
  starOpacity: number;
  moonOpacity: number;
  sunDiscOpacity: number;
  cloudOpacity: number;
  cloudDriftSpeed: number;
  terrainHueShift: number;
  terrainSaturationMul: number;
  terrainLightnessMul: number;
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
const weathers: Weather[] = ["clear", "windy", "rain", "snow", "mist"];

const seasonConfig: Record<Season, SeasonConfig> = {
  spring: {
    label: "春",
    skyDay: "#8eb6ac",
    skyNight: "#112033",
    fogDay: "#8db3a5",
    fogNight: "#0d1822",
    ambient: "#efe0bd",
    sun: "#ffe9b9",
    rim: "#8ab6c3"
  },
  summer: {
    label: "夏",
    skyDay: "#89b9b6",
    skyNight: "#0f2031",
    fogDay: "#7aa7a4",
    fogNight: "#0b1720",
    ambient: "#f3e6c2",
    sun: "#fff1ce",
    rim: "#7cb2bf"
  },
  autumn: {
    label: "秋",
    skyDay: "#b7a27e",
    skyNight: "#1a2133",
    fogDay: "#b59674",
    fogNight: "#161b28",
    ambient: "#f0dec0",
    sun: "#ffdca2",
    rim: "#a8b4cb"
  },
  winter: {
    label: "冬",
    skyDay: "#9ab0c5",
    skyNight: "#11192a",
    fogDay: "#aab9c9",
    fogNight: "#0c1320",
    ambient: "#dfe7ef",
    sun: "#f7f6ff",
    rim: "#9ec0dd"
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

export function daylightFactor(timeOfDay: number): number {
  return dayFactor(timeOfDay);
}

export function seasonLabel(season: Season): string {
  return seasonConfig[season].label;
}

export function weatherLabel(weather: Weather): string {
  return weatherConfig[weather].label;
}

export function formatTimeOfDay(timeOfDay: number): string {
  const hours = Math.floor(timeOfDay);
  const minutes = Math.floor((timeOfDay - hours) * 60);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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
  private seasonIndex = 0;
  private weatherIndex = 0;
  private weatherTimer = 0;
  private seasonTimer = 0;
  private nextWeatherDelay = 45;
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

  state: EnvironmentState = {
    timeOfDay: 7.5,
    dayCount: 1,
    season: seasons[0],
    weather: weathers[0]
  };

  update(deltaSeconds: number): EnvironmentState {
    const previousTime = this.state.timeOfDay;
    const nextTime = previousTime + deltaSeconds * 0.18;
    this.state.timeOfDay = nextTime >= 24 ? nextTime - 24 : nextTime;

    if (nextTime >= 24) {
      this.state.dayCount += 1;
    }

    this.weatherTimer += deltaSeconds;
    this.seasonTimer += deltaSeconds;

    if (this.weatherTimer >= this.nextWeatherDelay) {
      this.weatherTimer = 0;
      this.advanceWeather();
      this.nextWeatherDelay = 36 + Math.random() * 34;
    }

    if (this.seasonTimer >= 180) {
      this.seasonTimer = 0;
      this.advanceSeason();
    }

    // 同步过渡：t 在 12 秒内走完 0→1，所有 channel 同步 lerp。
    if (this.weatherTransitionTarget !== this.state.weather) {
      // 新 target：把当前 effective 锁为 from，新 target 设进 transitionTarget。
      this.weatherTransitionFrom = { ...this.effectiveWeather };
      this.weatherTransitionTarget = this.state.weather;
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

  advanceSeason(): void {
    this.seasonIndex = (this.seasonIndex + 1) % seasons.length;
    this.state.season = seasons[this.seasonIndex]!;

    if (this.state.season === "winter" && this.state.weather === "rain") {
      this.weatherIndex = weathers.indexOf("snow");
      this.state.weather = "snow";
    }
  }

  advanceWeather(): void {
    const options =
      this.state.season === "winter"
        ? (["clear", "windy", "mist", "snow"] as Weather[])
        : this.state.season === "summer"
          ? (["clear", "windy", "rain", "mist"] as Weather[])
          : (["clear", "windy", "rain", "mist"] as Weather[]);

    const currentIndex = options.indexOf(this.state.weather);
    const nextIndex = (currentIndex + 1 + Math.floor(Math.random() * options.length)) % options.length;
    this.state.weather = options[nextIndex]!;
    this.weatherIndex = weathers.indexOf(this.state.weather);
  }

  computeVisuals(): EnvironmentVisuals {
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
    const solar = Math.sin(((this.state.timeOfDay - 6) / 24) * Math.PI * 2);
    const nightReadableSky = new Color(season.skyNight).lerp(
      new Color("#314648"),
      celestial.nightReadability * 0.34
    );
    const skyColor = nightReadableSky.lerp(new Color(season.skyDay), daylight);
    const fogColor = new Color(season.fogNight)
      .lerp(new Color("#49645e"), celestial.nightReadability * 0.35)
      .lerp(new Color(season.fogDay), daylight);
    const ambientColor = new Color(season.ambient).multiplyScalar(
      MathUtils.lerp(celestial.nightReadability, 1, daylight)
    );
    const sunColor = new Color(season.sun).lerp(new Color("#cfd8ef"), 1 - daylight);
    const moonColor = new Color("#dce7ff").lerp(new Color("#fff2d0"), daylight * 0.18);
    const cloudColor = new Color("#d7d2ad").lerp(new Color("#f4ead0"), daylight);
    const rimColor = new Color(season.rim).multiplyScalar(MathUtils.lerp(0.5, 1, daylight));
    const sunDirection = new Vector3(
      Math.cos(((this.state.timeOfDay - 12) / 24) * Math.PI * 2) * 90,
      MathUtils.lerp(10, 160, Math.max(solar, 0)),
      Math.sin(((this.state.timeOfDay - 12) / 24) * Math.PI * 2) * 54
    );
    const moonDirection = sunDirection.clone().multiplyScalar(-0.74);
    moonDirection.y = Math.max(28, -sunDirection.y + 48);

    return {
      skyColor,
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
      fogDensity: MathUtils.lerp(0.0075, 0.0032, daylight) + weather.fogBoost * 0.55,
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
      starOpacity: celestial.starOpacity,
      moonOpacity: celestial.moonOpacity,
      sunDiscOpacity: celestial.sunDiscOpacity,
      cloudOpacity: celestial.cloudOpacity,
      cloudDriftSpeed: celestial.cloudDriftSpeed,
      terrainHueShift:
        this.state.season === "spring"
          ? 0.015
          : this.state.season === "summer"
            ? 0.03
            : this.state.season === "autumn"
              ? -0.018
              : -0.01,
      // terrain mult 改成基于 effectiveWeather 的连续混合，让天气过渡也
      // 平滑——硬开关会让山色一帧跳一次。
      // 基线 = season-based。雨/雪/雾按各自强度往各自的目标拉。
      terrainSaturationMul: (() => {
        const seasonBase =
          this.state.season === "summer"
            ? 1.08
            : this.state.season === "winter"
              ? 0.82
              : 1;
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
      })()
    };
  }
}
