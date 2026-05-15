export type CharacterAssetId = "xbot" | "meshy";

export interface CharacterAssetConfig {
  id: CharacterAssetId;
  label: string;
  url: string;
  heightMeters: number;
  animated: boolean;
  forceOpaqueMaterials?: boolean;
  clipPreferences?: Partial<Record<"idle" | "walk" | "run", string[]>>;
  clipTimeScale?: Partial<Record<"idle" | "walk" | "run", number>>;
  /** 数字键 1-9 直接播 clip 的映射（索引 0 = 按 1）。未提供则按 GLB clip key 顺序。 */
  digitKeyClips?: string[];
  /** 数字键对应的人类可读标签（同步索引）。未提供则 HUD 显示 clip 原始名。 */
  digitKeyLabels?: string[];
  /** 额外 Y 偏移（米）。getFootYOffset 在某些模型上不准时手动校正。负值=下沉。 */
  extraYOffset?: number;
}

export const CHARACTER_ASSETS: Record<CharacterAssetId, CharacterAssetConfig> = {
  xbot: {
    id: "xbot",
    label: "Xbot.glb",
    url: "/models/skeletal/Xbot.glb",
    heightMeters: 1.75,
    animated: true
  },
  meshy: {
    id: "meshy",
    label: "Meshy Tang scholar animated",
    url: "/models/skeletal/Meshy_AI_Meshy_Merged_Animations.glb",
    heightMeters: 1.6,
    animated: true,
    forceOpaqueMaterials: true,
    extraYOffset: -0.04, // 微调让脚底贴地（用户在 panel 调的最终值）
    // GLB 内置 clips: Idle_12, Idle_3, Idle_4, RunFast, Running, Walking, climbing_up_wall
    // ⚠️ Meshy 给的 clip 名字和实际动画不对应（AI 元数据错标）。
    // 用户实际观察到的真实对应：
    //   "RunFast"        → 慢走
    //   "Running"        → 爬墙
    //   "Walking"        → 站立 / idle
    //   "climbing_up_wall" → 站立 / idle
    //   "Idle_4"         → 前进（跑）
    //   "Idle_3"         → 冲刺（快跑）
    //   "Idle_12"        → 未知（也作 idle 备选）
    // 以下所有映射都按【真实动画】使用 clip 名，不要按字面意思。
    clipPreferences: {
      idle: ["climbing_up_wall", "Walking", "Idle_12"], // 用户选 7 号（climbing_up_wall 实际是站立）
      walk: ["Idle_4"],                                  // 按 W = 普通跑（Idle_4 实际是跑动画）
      run: ["Idle_3"]                                    // Shift+W = 冲刺（Idle_3 实际是快跑）
    },
    clipTimeScale: {
      idle: 0.2,
      walk: 1.0,
      run: 1.0
    },
    // 数字键映射（按用户语义 1-7 → 真实动作）：
    //   1 备 idle / 2 冲刺 / 3 前进 / 4 慢走 / 5 爬峭壁 / 6 idle / 7 备 idle
    digitKeyClips: [
      "Idle_12",          // 1 备 idle（未确认）
      "Idle_3",           // 2 冲刺（实际表现是快跑）
      "Idle_4",           // 3 前进（实际表现是跑）
      "RunFast",          // 4 慢走（实际表现是走）
      "Running",          // 5 爬峭壁（实际表现是爬）
      "Walking",          // 6 idle（实际表现是站立）
      "climbing_up_wall"  // 7 备 idle（实际表现也是站立）
    ],
    digitKeyLabels: [
      "备idle?",
      "冲刺",
      "前进",
      "慢走",
      "爬峭壁",
      "idle 站立",
      "备 站立"
    ]
  }
};

export function resolveCharacterAsset(search: string): CharacterAssetConfig {
  const params = new URLSearchParams(search);
  const requested = params.get("character");
  if (requested === "xbot") return CHARACTER_ASSETS.xbot;
  if (requested === "meshy") return CHARACTER_ASSETS.meshy;
  return CHARACTER_ASSETS.meshy;
}
