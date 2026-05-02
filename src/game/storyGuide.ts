import { Vector2 } from "three";

export interface StoryBeat {
  id: string;
  title: string;
  guidance: string;
  completionLine: string;
  target: Vector2;
  completionRadius: number;
  requiredFragmentId?: string;
}

export interface StoryGuideSnapshot {
  activeBeat: StoryBeat | null;
  completedBeat: StoryBeat | null;
  completedCount: number;
  totalBeats: number;
}

const qinlingStoryBeats: StoryBeat[] = [
  {
    id: "guanzhong-departure",
    title: "关中起行",
    guidance: "先感受腹地的开阔，再向山前推进，拾起第一片关于组织力的残简。",
    completionLine: "你已经读懂了：平原不仅便于行走，更便于组织。",
    target: new Vector2(84, -69),
    completionRadius: 9,
    requiredFragmentId: "guanzhong-heartland"
  },
  {
    id: "qinling-approach",
    title: "逼近山墙",
    guidance: "继续南下，直到秦岭从背景变成阻隔本身，去看连续山脊怎样压缩路径。",
    completionLine: "你已经贴近秦岭北麓，山墙的意义开始超过单座高峰。",
    target: new Vector2(10, -38),
    completionRadius: 11,
    requiredFragmentId: "qinling-wall"
  },
  {
    id: "pass-lock",
    title: "穿过锁口",
    guidance: "不要执着于最高峰，去找那条真正能过山的缝，那才是地理把人逼出的选择。",
    completionLine: "你已经来到锁口附近，过山的意义第一次压过了直线距离。",
    target: new Vector2(-32, -16),
    completionRadius: 11,
    requiredFragmentId: "mountain-pass"
  },
  {
    id: "hanzhong-hinge",
    title: "抵达门轴",
    guidance: "翻过山后别急着继续南下，先在汉中停一下，感受它为何像门轴而不是终点。",
    completionLine: "你已经站上汉中门轴，方向在这里突然变多了。",
    target: new Vector2(26, -8),
    completionRadius: 10,
    requiredFragmentId: "hanzhong-hinge"
  },
  {
    id: "southern-compression",
    title: "再度收紧",
    guidance: "离开汉中之后，继续向南体会第二次压缩，看看山道如何把时间和错误一起放大。",
    completionLine: "你已经进入南侧山地，入蜀前的第二次压缩开始生效。",
    target: new Vector2(12, 84),
    completionRadius: 12,
    requiredFragmentId: "sichuan-gate"
  },
  {
    id: "basin-release",
    title: "盆地舒展",
    guidance: "穿过最后一道收口，去成都平原感受空间为何会忽然从险道变成可以安顿的腹地。",
    completionLine: "你已经走完这条南北叙事线，秦岭与盆地的关系开始闭合。",
    target: new Vector2(-42, 102),
    completionRadius: 12,
    requiredFragmentId: "chengdu-release"
  }
];

export function getQinlingStoryBeats(): StoryBeat[] {
  return qinlingStoryBeats.map((beat) => ({
    ...beat,
    target: beat.target.clone()
  }));
}

export function evaluateStoryGuide(
  storyBeats: StoryBeat[],
  playerPosition: Vector2,
  collectedIds: Set<string>,
  completedBeatIds: Set<string>
): StoryGuideSnapshot {
  let completedBeat: StoryBeat | null = null;

  for (const beat of storyBeats) {
    if (completedBeatIds.has(beat.id)) {
      continue;
    }

    const isComplete = beat.requiredFragmentId
      ? collectedIds.has(beat.requiredFragmentId)
      : beat.target.distanceTo(playerPosition) <= beat.completionRadius;

    if (isComplete) {
      completedBeat = beat;
      break;
    }
  }

  const completedCount =
    completedBeatIds.size + (completedBeat && !completedBeatIds.has(completedBeat.id) ? 1 : 0);
  const activeBeat =
    storyBeats.find((beat) => !completedBeatIds.has(beat.id) && beat.id !== completedBeat?.id) ??
    null;

  return {
    activeBeat,
    completedBeat,
    completedCount,
    totalBeats: storyBeats.length
  };
}

export function formatStoryGuideLine(snapshot: StoryGuideSnapshot): string {
  if (!snapshot.activeBeat) {
    return "主线：这条南北叙事线已经走通，接下来可以自由漫游。";
  }

  return `主线：${snapshot.completedCount + 1}/${snapshot.totalBeats} · ${snapshot.activeBeat.title} · ${snapshot.activeBeat.guidance}`;
}
