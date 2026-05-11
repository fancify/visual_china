export interface HudPanelVisibility {
  visible: boolean;
  openByDefault: boolean;
}

export const compactHudPanelConfig: {
  mode: HudPanelVisibility;
  overview: HudPanelVisibility;
  controls: HudPanelVisibility;
  status: HudPanelVisibility;
  journal: HudPanelVisibility;
} = {
  mode: {
    visible: false,
    openByDefault: false
  },
  overview: {
    // 用户："右上角小地图默认展开" → openByDefault: true
    visible: true,
    openByDefault: true
  },
  controls: {
    // 用户："操作提示也可以去掉"
    visible: false,
    openByDefault: false
  },
  status: {
    // 用户："右下角的当前旅程可以去掉了"
    visible: false,
    openByDefault: false
  },
  journal: {
    visible: false,
    openByDefault: false
  }
};

export const visibleStatusLineIds: string[] = [];
