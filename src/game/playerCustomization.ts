import {
  AVATAR_DEFINITIONS,
  type AvatarDefinition,
  type AvatarId
} from "./avatars.js";
import {
  MOUNT_DEFINITIONS,
  type MountDefinition,
  type MountId
} from "./mounts.js";

/**
 * 玩家造型选择状态（mount + avatar），持久化到 localStorage。
 *
 * 默认值：旧的"枣红木马 + 斗笠红袍游侠" → mount=horse / avatar=default。
 *
 * - localStorage 失败时（隐私模式 / SSR）静默 fallback 到默认，不报错
 * - 提供 cycleMount / cycleAvatar 给键盘快捷键（[, ], -, =）
 * - 列出全部 definition 给 UI 用
 */

const STORAGE_KEY_MOUNT = "qianli.mount";
const STORAGE_KEY_AVATAR = "qianli.avatar";

const VALID_MOUNT_IDS = new Set<MountId>(
  MOUNT_DEFINITIONS.map((entry) => entry.id)
);
const VALID_AVATAR_IDS = new Set<AvatarId>(
  AVATAR_DEFINITIONS.map((entry) => entry.id)
);

const DEFAULT_MOUNT: MountId = "horse";
const DEFAULT_AVATAR: AvatarId = "default";

export interface PlayerCustomization {
  mountId: MountId;
  avatarId: AvatarId;
}

function safeReadStorage(key: string): string | null {
  try {
    if (typeof localStorage === "undefined") {
      return null;
    }
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteStorage(key: string, value: string): void {
  try {
    if (typeof localStorage === "undefined") {
      return;
    }
    localStorage.setItem(key, value);
  } catch {
    /* 隐私模式 / 配额满 / 不可写：忽略，下次会话照样能跑 */
  }
}

export function loadPlayerCustomization(): PlayerCustomization {
  const rawMount = safeReadStorage(STORAGE_KEY_MOUNT);
  const rawAvatar = safeReadStorage(STORAGE_KEY_AVATAR);

  const mountId =
    rawMount && VALID_MOUNT_IDS.has(rawMount as MountId)
      ? (rawMount as MountId)
      : DEFAULT_MOUNT;
  const avatarId =
    rawAvatar && VALID_AVATAR_IDS.has(rawAvatar as AvatarId)
      ? (rawAvatar as AvatarId)
      : DEFAULT_AVATAR;

  return { mountId, avatarId };
}

export function savePlayerCustomization(state: PlayerCustomization): void {
  safeWriteStorage(STORAGE_KEY_MOUNT, state.mountId);
  safeWriteStorage(STORAGE_KEY_AVATAR, state.avatarId);
}

/** 在列表中循环切换。step=+1 表示下一个，-1 表示上一个。 */
function cycle<T extends { id: string }>(
  list: readonly T[],
  currentId: string,
  step: 1 | -1
): T {
  const index = list.findIndex((item) => item.id === currentId);
  const safeIndex = index < 0 ? 0 : index;
  const nextIndex = (safeIndex + step + list.length) % list.length;
  return list[nextIndex];
}

export function cycleMount(currentId: MountId, step: 1 | -1): MountId {
  return cycle(MOUNT_DEFINITIONS, currentId, step).id;
}

export function cycleAvatar(currentId: AvatarId, step: 1 | -1): AvatarId {
  return cycle(AVATAR_DEFINITIONS, currentId, step).id;
}

export function listMounts(): MountDefinition[] {
  return [...MOUNT_DEFINITIONS];
}

export function listAvatars(): AvatarDefinition[] {
  return [...AVATAR_DEFINITIONS];
}

export type { MountId, AvatarId, MountDefinition, AvatarDefinition };
