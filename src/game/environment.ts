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

export class EnvironmentController {
  private seasonIndex = 0;
  private weatherIndex = 0;
  private weatherTimer = 0;
  private seasonTimer = 0;
  private nextWeatherDelay = 45;

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
    const weather = weatherConfig[this.state.weather];
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
      precipitationOpacity: weather.rain > 0 ? 0.6 : weather.snow > 0 ? 0.42 : 0,
      precipitationColor: new Color(weather.snow > 0 ? "#f7fbff" : "#9fc7d8"),
      precipitationSize: weather.snow > 0 ? 0.42 : 0.18,
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
      terrainSaturationMul:
        this.state.weather === "mist"
          ? 0.8
          : this.state.weather === "snow"
            ? 0.72
            : this.state.weather === "rain"
              ? 0.88
              : this.state.season === "summer"
                ? 1.08
                : this.state.season === "winter"
                  ? 0.82
                  : 1,
      terrainLightnessMul:
        this.state.weather === "snow"
          ? 1.14
        : this.state.weather === "rain"
            ? 0.92
            : this.state.weather === "mist"
              ? 0.96
              : MathUtils.lerp(celestial.terrainLightnessFloor, 1.06, daylight)
    };
  }
}
