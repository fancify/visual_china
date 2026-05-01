export interface HudPanelVisibility {
  openByDefault: boolean;
}

export const compactHudPanelConfig: {
  mode: HudPanelVisibility;
  overview: HudPanelVisibility;
  controls: HudPanelVisibility;
  status: HudPanelVisibility;
};

export const visibleStatusLineIds: string[];
