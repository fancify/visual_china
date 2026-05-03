import { Group, Mesh } from "three";

import { createAvatar } from "./avatars.js";
import { createMount } from "./mounts.js";
import {
  loadPlayerCustomization,
  type AvatarId,
  type MountId
} from "./playerCustomization.js";

/**
 * 玩家 mesh 组合 = mount（坐骑）+ avatar（骑手），由 mount + avatar 各自 builder 装配。
 *
 * 历史形状 createPlayerAvatar() 仍然返回 `{ player, horseLegsByName }`：
 * - main.ts 可以零改动继续跑（如果不开 mount/avatar 切换）
 * - 也提供新的 `mountLegsByName` 别名用于 future-proof 命名
 *
 * 切换坐骑/造型时调用 `rebuildPlayerAvatar(player, mountId, avatarId)`，
 * 它会清空 player Group 内所有子节点 + dispose 旧 mesh，再装入新 mount + avatar。
 * 注意：player Group 本身（持有 position / rotation）保持不变。
 */

export interface PlayerAvatarHandle {
  /** 玩家 root group。`scene.add(player)` 后玩家所有 mesh 都在它下面。 */
  player: Group;
  /** 4 条腿引用，按 name 索引；旧名称保留以兼容老代码。 */
  horseLegsByName: Map<string, Mesh>;
  /** 与 horseLegsByName 同物，新代码请用此别名。 */
  mountLegsByName: Map<string, Mesh>;
  /** 当前坐骑 id */
  mountId: MountId;
  /** 当前 avatar id */
  avatarId: AvatarId;
}

function disposeMesh(mesh: Mesh): void {
  // geometry / material 都是 Mesh 创建时持有的——切换 avatar 时清掉避免泄露。
  // material 可能是数组（多 material slot），逐个 dispose。
  mesh.geometry?.dispose();
  const material = mesh.material;
  if (Array.isArray(material)) {
    material.forEach((m) => m.dispose?.());
  } else {
    material?.dispose?.();
  }
}

function clearGroup(group: Group): void {
  // 用 while + 第一个子节点的方式：避免 forEach 对正在被改的数组迭代出错。
  while (group.children.length > 0) {
    const child = group.children[0];
    group.remove(child);
    child.traverse((node) => {
      if ((node as Mesh).isMesh) {
        disposeMesh(node as Mesh);
      }
    });
  }
}

function assemble(
  player: Group,
  mountId: MountId,
  avatarId: AvatarId
): { mountLegs: Map<string, Mesh> } {
  const mountHandle = createMount(mountId);
  const avatarHandle = createAvatar(avatarId);

  // avatar 局部坐标系以 saddle 顶面为 y=0；放到 mount.saddleHeight 上方即可。
  avatarHandle.avatar.position.set(
    mountHandle.saddleX,
    mountHandle.saddleHeight,
    0
  );

  player.add(mountHandle.mount);
  player.add(avatarHandle.avatar);

  return { mountLegs: mountHandle.legsByName };
}

/**
 * 创建玩家 avatar handle。第一次调用时从 localStorage 读取上次选择，
 * 没有的话用默认（horse + default rider）。
 */
export function createPlayerAvatar(): PlayerAvatarHandle {
  const customization = loadPlayerCustomization();
  const player = new Group();
  const { mountLegs } = assemble(player, customization.mountId, customization.avatarId);

  return {
    player,
    horseLegsByName: mountLegs,
    mountLegsByName: mountLegs,
    mountId: customization.mountId,
    avatarId: customization.avatarId
  };
}

/**
 * 切换 mount/avatar。会清空 player Group 子节点（dispose 旧 geometry/material），
 * 再装入新 mount + avatar。返回新的 leg map。
 *
 * 注意：调用方需要把 main.ts 持有的 horseLegsByName / mountLegsByName 引用同步成新的。
 */
export function rebuildPlayerAvatar(
  player: Group,
  mountId: MountId,
  avatarId: AvatarId
): { mountLegsByName: Map<string, Mesh> } {
  clearGroup(player);
  const { mountLegs } = assemble(player, mountId, avatarId);
  return { mountLegsByName: mountLegs };
}
