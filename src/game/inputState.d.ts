export function normalizeInputKey(key: string): string;

export function isGameplayInputKey(key: string): boolean;

export function movementAxesFromKeys(keys: Set<string>): {
  forward: number;
  right: number;
};

export function clearGameplayInput(keys: Set<string>): Set<string>;
