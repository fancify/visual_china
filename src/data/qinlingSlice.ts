import { Vector2 } from "three";

import { geoToWorld } from "../game/geoProjection.js";
import { qinlingRegionBounds, qinlingRegionWorld } from "./qinlingRegion.js";

export type ViewMode = "terrain" | "livelihood" | "war" | "military";
export type LandmarkKind = "city" | "pass" | "river" | "mountain" | "plain";

export interface ModeMeta {
  title: string;
  description: string;
}

export interface Landmark {
  name: string;
  kind: LandmarkKind;
  subKind?: string;
  position: Vector2;
  description: string;
}

// 旧 sliceWorld 是 180×240，但从 Phase 2 全国扩张起，只剩注释意义。运行时
// 一律以 qinlingRegionWorld 为准；这里保留是为了兼容某些只用 width/depth 字段
// 的旧检查。
export const sliceWorld = {
  width: 180,
  depth: 240,
  segmentsX: 220,
  segmentsZ: 280
};

export const viewModes: ViewMode[] = [
  "terrain",
  "livelihood",
  "war",
  "military"
];

export const modeMeta: Record<ViewMode, ModeMeta> = {
  terrain: {
    title: "地形",
    description: "看秦岭怎样像一道横墙，把关中、汉中与巴蜀压成完全不同的空间。"
  },
  livelihood: {
    title: "生活",
    description: "看哪里能养城、养路、养人，哪里则只能沿着河谷和山口艰难展开。"
  },
  war: {
    title: "战争",
    description: "看平原如何利于展开，山道如何放大补给与路线选择的代价。"
  },
  military: {
    title: "军事",
    description: "看腹地、锁眼、山口与盆地纵深怎样决定控制力与持久力。"
  }
};

// 把每个 landmark 的预期地理位置投影到当前 world，避免硬编码 world 坐标
// 在 bounds 改动后漂移。Phase 2 全国扩张前是 (sliceWorld 180×240)，扩张后是
// qinlingRegionWorld (1711×1186)——这里只用 lat/lon 让 world 自动跟随。
function geoLandmark(
  lat: number,
  lon: number,
  meta: Omit<Landmark, "position">
): Landmark {
  const projected = geoToWorld(
    { lat, lon },
    qinlingRegionBounds,
    qinlingRegionWorld
  );
  return { ...meta, position: new Vector2(projected.x, projected.z) };
}

export const landmarks: Landmark[] = [
  geoLandmark(33.95, 107.78, {
    name: "太白主脊",
    kind: "mountain",
    description: "秦岭横墙在此最有压迫感。"
  }),
  geoLandmark(32.4, 106.5, {
    name: "米仓山",
    kind: "mountain",
    description: "入蜀前的第二道压迫。"
  }),
  geoLandmark(32.2, 105.55, {
    name: "剑门关",
    kind: "pass",
    subKind: "major-pass",
    description: "广元剑阁一带的入蜀锁口，两侧山势夹峙，让通道变成关隘。"
  })
];

// 默认 routeStart 投到关中（西安）；regionBundle.content.routeStart 可在加载
// poiManifest 时覆盖。
const _routeStart = geoToWorld(
  { lat: 34.34, lon: 108.94 },
  qinlingRegionBounds,
  qinlingRegionWorld
);
export const routeStart = new Vector2(_routeStart.x, _routeStart.z);
