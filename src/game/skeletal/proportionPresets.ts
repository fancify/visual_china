import type { ProportionProfile } from "./SkeletalCharacter.js";

/**
 * Body base 比例预设。
 *
 * 架构定位（2026-05-13 更新）：
 * Avatar = body × outfit。Body base 决定 mesh / 长相 / 性别轮廓；
 * Outfit 是衣物层（文人 / 武将 / 游侠 / 农夫 / 僧人 / 道士 / default 等）。
 * 同一 outfit 可穿在 male/female body 上得到不同最终角色。
 *
 * 当前两个 base 的体型数值灵感来源于 BotW Link / Zelda 的身材轮廓
 * 推算，但 mesh 还是 Mixamo Xbot 灰模 — 真"长相区分"要到 M4 时
 * 替换成 anime/Tang-style 男女 mesh 才能实现（VRoid Studio / VRoid
 * Hub CC0）。当前数值仅用于骨骼级 silhouette 差异。
 */

export interface NamedPreset {
  name: string;
  description: string;
  heightMeters: number;
  proportions: ProportionProfile;
}

export const BODY_BASE_MALE_ATHLETIC: NamedPreset = {
  name: "Male — athletic 青年",
  description: "瘦削青年，肩稍宽于胯，长腿；~1.68m。BotW Link 体型轮廓启发。",
  heightMeters: 1.68,
  proportions: {
    head: 0.95,
    shoulderWidth: 0.98,
    armWidth: 0.78,
    hipWidth: 0.90,
    legWidth: 0.80,
    torsoWidth: 0.88,
    legLength: 1.03
  }
};

export const BODY_BASE_FEMALE_SLENDER: NamedPreset = {
  name: "Female — slender 青年",
  description: "纤细青年，肩窄胯略宽，长腿；~1.62m。BotW Zelda 体型轮廓启发。",
  heightMeters: 1.62,
  proportions: {
    head: 0.96,
    shoulderWidth: 0.86,
    armWidth: 0.74,
    hipWidth: 1.02,
    legWidth: 0.78,
    torsoWidth: 0.84,
    legLength: 1.03
  }
};

export const BODY_BASE_DEFAULT_YBOT: NamedPreset = {
  name: "Mixamo Y-Bot 默认（无修改）",
  description: "原始比例不动，1.83m。开发参考 / 回归对照。",
  heightMeters: 1.83,
  proportions: {
    head: 1,
    shoulderWidth: 1,
    armWidth: 1,
    hipWidth: 1,
    legWidth: 1,
    torsoWidth: 1,
    legLength: 1
  }
};

export const ALL_BODY_BASES: NamedPreset[] = [
  BODY_BASE_MALE_ATHLETIC,
  BODY_BASE_FEMALE_SLENDER,
  BODY_BASE_DEFAULT_YBOT
];
