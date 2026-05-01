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
};

export const visibleStatusLineIds: string[];
