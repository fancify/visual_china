export function normalizeInputKey(eventOrKey: string | KeyboardEvent): string;

export function isGameplayInputKey(eventOrKey: string | KeyboardEvent): boolean;

export function movementAxesFromKeys(keys: Set<string>): {
  forward: number;
  right: number;
};

export function clearGameplayInput(keys: Set<string>): Set<string>;
