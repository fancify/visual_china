export interface PyramidTimePreset {
  label: string;
  timeOfDay: number;
}

export interface PyramidClockTarget {
  state: {
    timeOfDay: number;
  };
}

export const PYRAMID_TIME_PRESETS: readonly PyramidTimePreset[] = [
  { label: "深夜", timeOfDay: 0 },
  { label: "黎明", timeOfDay: 5.6 },
  { label: "清晨", timeOfDay: 8 },
  { label: "正午", timeOfDay: 12 },
  { label: "黄昏", timeOfDay: 17.8 },
  { label: "初夜", timeOfDay: 20.5 }
] as const;

export function pyramidTimePresetAfter(timeOfDay: number): PyramidTimePreset {
  const normalized = ((timeOfDay % 24) + 24) % 24;
  return (
    PYRAMID_TIME_PRESETS.find((preset) => preset.timeOfDay > normalized + 0.001) ??
    PYRAMID_TIME_PRESETS[0]!
  );
}

export function advancePyramidTimePreset(
  target: PyramidClockTarget
): PyramidTimePreset {
  const preset = pyramidTimePresetAfter(target.state.timeOfDay);
  target.state.timeOfDay = preset.timeOfDay;
  return preset;
}
