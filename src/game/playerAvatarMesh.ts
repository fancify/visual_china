import { Group, Mesh } from "three";

import { createAvatar } from "./avatars.js";
import { createMount } from "./mounts.js";
import { PLAYER_VISUAL_SCALE } from "./mountRuntime.js";
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
  /** 步行模式下的 avatar 腿引用；骑乘时为空。 */
  avatarWalkLegsByName: Map<string, Mesh>;
  /** 步行模式下的 avatar 手臂引用；骑乘时为空。 */
  avatarWalkArmsByName: Map<string, Mesh>;
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

function buildWalkingAvatarLegRig(avatar: Group): Map<string, Mesh> {
  const legCandidates = avatar.children
    .filter(
      (child): child is Mesh =>
        (child as Mesh).isMesh === true &&
        (child as Mesh).geometry.type === "CylinderGeometry" &&
        child.position.y <= 0.3
    )
    .sort((left, right) => right.position.z - left.position.z)
    .slice(0, 2);

  if (legCandidates.length < 2) {
    return new Map();
  }

  const avatarLegsByName = new Map<string, Mesh>();
  const specs = [
    {
      name: "avatar-walk-left-leg",
      z: 0.14,
      baseRotation: 0.08
    },
    {
      name: "avatar-walk-right-leg",
      z: -0.14,
      baseRotation: -0.08
    }
  ] as const;

  legCandidates.forEach((leg, index) => {
    const spec = specs[index];
    leg.name = spec.name;
    leg.position.set(0.02, -0.18, spec.z);
    leg.rotation.set(0, 0, spec.baseRotation);
    // 腿短化：原 1.55 拉长到接近成人比例，用户偏好"chibi 短腿"卡通感，
    // 降到 0.78（约一半），剪影更接近 千里江山图 风格的小人。
    leg.scale.set(1, 0.78, 1);
    avatarLegsByName.set(spec.name, leg);
  });

  return avatarLegsByName;
}

export function buildWalkingAvatarArmRig(avatar: Group): Map<string, Mesh> {
  const leftArm = avatar.getObjectByName("avatar-arm-left") as Mesh | undefined;
  const rightArm = avatar.getObjectByName("avatar-arm-right") as Mesh | undefined;

  if (
    !leftArm ||
    !rightArm ||
    leftArm.isMesh !== true ||
    rightArm.isMesh !== true
  ) {
    return new Map();
  }

  const armsByName = new Map<string, Mesh>();
  const armSpecs = [
    {
      key: "avatar-walk-left-arm",
      mesh: leftArm,
      z: 0.32,
      baseRotation: -0.15
    },
    {
      key: "avatar-walk-right-arm",
      mesh: rightArm,
      z: -0.32,
      baseRotation: 0.15
    }
  ] as const;

  armSpecs.forEach((spec) => {
    spec.mesh.position.set(0.04, 0.7, spec.z);
    spec.mesh.rotation.set(0, 0, spec.baseRotation);
    armsByName.set(spec.key, spec.mesh);
  });

  return armsByName;
}

function assemble(
  player: Group,
  mountId: MountId,
  avatarId: AvatarId
): {
  mountLegs: Map<string, Mesh>;
  avatarWalkLegs: Map<string, Mesh>;
  avatarWalkArms: Map<string, Mesh>;
} {
  const mountHandle = createMount(mountId);
  const avatarHandle = createAvatar(avatarId);
  const avatarWalkLegs =
    mountId === "none"
      ? buildWalkingAvatarLegRig(avatarHandle.avatar)
      : new Map<string, Mesh>();
  const avatarWalkArms =
    mountId === "none"
      ? buildWalkingAvatarArmRig(avatarHandle.avatar)
      : new Map<string, Mesh>();

  // 骑乘时以 saddle 顶面为 y=0；步行时把 avatar 原点压低到脚底附近。
  if (mountId === "none") {
    avatarHandle.avatar.position.set(0, 0.08, 0);
  } else {
    avatarHandle.avatar.position.set(
      mountHandle.saddleX,
      mountHandle.saddleHeight,
      0
    );
  }

  player.add(mountHandle.mount);
  player.add(avatarHandle.avatar);

  return {
    mountLegs: mountHandle.legsByName,
    avatarWalkLegs,
    avatarWalkArms
  };
}

/**
 * 创建玩家 avatar handle。第一次调用时从 localStorage 读取上次选择，
 * 没有的话用默认（horse + default rider）。
 */
export function createPlayerAvatar(): PlayerAvatarHandle {
  const customization = loadPlayerCustomization();
  const player = new Group();
  player.scale.setScalar(PLAYER_VISUAL_SCALE);
  const { mountLegs, avatarWalkLegs, avatarWalkArms } = assemble(
    player,
    customization.mountId,
    customization.avatarId
  );

  return {
    player,
    horseLegsByName: mountLegs,
    mountLegsByName: mountLegs,
    mountId: customization.mountId,
    avatarId: customization.avatarId,
    avatarWalkLegsByName: avatarWalkLegs,
    avatarWalkArmsByName: avatarWalkArms
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
): {
  mountLegsByName: Map<string, Mesh>;
  avatarWalkLegsByName: Map<string, Mesh>;
  avatarWalkArmsByName: Map<string, Mesh>;
} {
  clearGroup(player);
  const { mountLegs, avatarWalkLegs, avatarWalkArms } = assemble(
    player,
    mountId,
    avatarId
  );
  return {
    mountLegsByName: mountLegs,
    avatarWalkLegsByName: avatarWalkLegs,
    avatarWalkArmsByName: avatarWalkArms
  };
}
