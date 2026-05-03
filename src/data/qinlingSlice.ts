import { Vector2 } from "three";

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

export const landmarks: Landmark[] = [
  {
    name: "陈仓道",
    kind: "pass",
    subKind: "gorge-pass",
    position: new Vector2(23.89, -60.48),
    description: "从陈仓、大散关一带折入秦岭的西线通道，山地把路线压成可控锁口。"
  },
  {
    name: "太白主脊",
    kind: "mountain",
    position: new Vector2(6, -20),
    description: "秦岭横墙在此最有压迫感。"
  },
  {
    name: "米仓山",
    kind: "mountain",
    position: new Vector2(-6, 58),
    description: "入蜀前的第二道压迫。"
  },
  {
    name: "剑门关",
    kind: "pass",
    subKind: "major-pass",
    position: new Vector2(-23.24, 33.6),
    description: "广元剑阁一带的入蜀锁口，两侧山势夹峙，让通道变成关隘。"
  },
  {
    name: "剑门蜀道",
    kind: "pass",
    subKind: "gorge-pass",
    position: new Vector2(-18, 31),
    description: "汉中南下入蜀的关键路线，第二次把行军面压缩成少数节点。"
  }
];

export const routeStart = new Vector2(84, -69);
