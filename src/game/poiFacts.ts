export function stripPoiMarkdown(value: string): string {
  return value
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/#{1,6}\s+/g, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncatePoiText(value: string, maxLength: number): string {
  const normalized = stripPoiMarkdown(value);
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

export function inferPoiFounded(text: string): string {
  const normalized = stripPoiMarkdown(text);
  const patterns = [
    /((?:秦|汉|东汉|西汉|三国|吴|魏|晋|东晋|北魏|北周|隋|唐|武德|贞观|开元|天宝|大业|开皇|永平|太延|黄武)[^，。；、]{0,14}[元一二三四五六七八九十百千\d]+年（?\d{1,4}）?)(?:[^，。；]{0,8})(?:始建|所立|置|立|筑|建|另起|起|开凿|通)/,
    /((?:前\s*)?\d{1,4}\s*年)(?:[^，。；]{0,8})(?:始建|所立|置|立|筑|建|另起|起|开凿|通)/,
    /((?:北周|北魏|隋|唐|东汉|西汉|三国|吴|魏|晋)[（(]\d{3,4}[-—至]\d{3,4}[）)]时?)(?:[^，。；]{0,8})(?:始建|所立|置|立|筑|建|另起|起|开凿|通)/
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) return match[1].replace(/\s+/g, "");
  }
  return "未详";
}
