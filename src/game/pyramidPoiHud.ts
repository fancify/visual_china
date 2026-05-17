import {
  POI_REGISTRY,
  POI_TAXONOMY,
  type PoiEntry
} from "../data/poiRegistry.generated.js";
import {
  inferPoiFounded,
  stripPoiMarkdown,
  truncatePoiText
} from "./poiFacts.js";

export { inferPoiFounded };

export interface PyramidPoiHud {
  setHoverTarget(poi: PoiEntry | null, pointer?: PoiHoverPointer | null): void;
  showDetail(poi: PoiEntry): void;
  toggleDetail(): void;
  hideDetail(): void;
  currentPoi(): PoiEntry | null;
}

type PoiIndexMode = "geo" | "admin";
export interface PoiHoverPointer {
  clientX: number;
  clientY: number;
}

function escapeHtml(value: string | number | undefined | null): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function categoryLabel(category: PoiEntry["category"]): string {
  if (category === "city") return "城邑";
  if (category === "relic") return "古迹";
  if (category === "scenic") return "山川";
  return "交通";
}

function sourceQualityLabel(sourceQuality: PoiEntry["sourceQuality"]): string {
  if (sourceQuality === "verified") return "史源较实";
  if (sourceQuality === "likely") return "较可信";
  return "待考";
}

function formatCoord(value: number, positive: string, negative: string): string {
  return `${Math.abs(value).toFixed(2)}°${value >= 0 ? positive : negative}`;
}

export function formatPoiLocation(poi: Pick<PoiEntry, "lat" | "lon">): string {
  return `${formatCoord(poi.lat, "N", "S")}, ${formatCoord(poi.lon, "E", "W")}`;
}

function foundedText(poi: Pick<PoiEntry, "founded" | "summary" | "detail">): string {
  return poi.founded && poi.founded !== "未详"
    ? poi.founded
    : inferPoiFounded(`${poi.summary} ${poi.detail}`);
}

function elevationText(poi: Pick<PoiEntry, "elevation">): string {
  return poi.elevation || "未详";
}

function formatTangValue(value: PoiEntry["tangDao"] | PoiEntry["tangAdmin"]): string {
  if (!value) return "未详";
  return typeof value === "string" ? value : value.join(" / ");
}

function formatTangLabel(
  displayValue: string | null | undefined,
  rawValue: PoiEntry["tangDao"] | PoiEntry["tangAdmin"]
): string {
  return displayValue || formatTangValue(rawValue);
}

function stripPoiInlineMarkdown(value: string): string {
  return value
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^[-*]\s+/gm, "")
    .replace(/[ \t]+/g, " ")
    .trim();
}

function resolvePoiMarkdownLink(currentPoi: PoiEntry, href: string): PoiEntry | undefined {
  if (/^[a-z]+:/i.test(href) || href.startsWith("#")) return undefined;
  const currentParts = currentPoi.docPath.split("/");
  currentParts.pop();
  const resolvedParts: string[] = [];
  for (const part of [...currentParts, ...href.split("/")]) {
    if (!part || part === ".") continue;
    if (part === "..") resolvedParts.pop();
    else resolvedParts.push(part);
  }
  const resolvedPath = resolvedParts.join("/");
  return POI_REGISTRY.find((poi) => poi.docPath === resolvedPath);
}

function renderInlineMarkdownHtml(value: string, currentPoi: PoiEntry): string {
  const tokens: string[] = [];
  const tokenized = value.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) => {
    const poi = resolvePoiMarkdownLink(currentPoi, href);
    const token = `@@LINK_${tokens.length}@@`;
    tokens.push(poi
      ? `<button class="pyramid-poi-inline-link" type="button" data-poi-id="${escapeHtml(poi.id)}">${escapeHtml(label)}</button>`
      : escapeHtml(label));
    return token;
  });
  let html = escapeHtml(tokenized)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");
  tokens.forEach((tokenHtml, index) => {
    html = html.replace(`@@LINK_${index}@@`, tokenHtml);
  });
  return html;
}

function isMarkdownTableStart(lines: string[], index: number): boolean {
  return Boolean(
    lines[index]?.trim().startsWith("|") &&
    lines[index + 1]?.trim().startsWith("|") &&
    /^\|\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[index + 1].trim())
  );
}

function parseMarkdownTableRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function renderMarkdownTable(lines: string[], currentPoi: PoiEntry): string {
  const rows = lines.map(parseMarkdownTableRow);
  const [head, _separator, ...body] = rows;
  return `
    <table class="pyramid-poi-markdown-table">
      <thead><tr>${head.map((cell) => `<th>${renderInlineMarkdownHtml(cell, currentPoi)}</th>`).join("")}</tr></thead>
      <tbody>
        ${body.map((row) => `<tr>${row.map((cell) => `<td>${renderInlineMarkdownHtml(cell, currentPoi)}</td>`).join("")}</tr>`).join("")}
      </tbody>
    </table>
  `;
}

function renderRelatedPoiBlock(lines: string[], currentPoi: PoiEntry): string {
  const items = lines
    .map((line) => {
      const match = line.match(/^\s*[-*]\s+\[([^\]]+)\]\(([^)]+)\)\s*(?:[—-]\s*(.*))?$/);
      if (!match) return "";
      const poi = resolvePoiMarkdownLink(currentPoi, match[2]);
      if (!poi) return "";
      const note = stripPoiInlineMarkdown(match[3] ?? "");
      return `
        <button class="pyramid-poi-related-link" type="button" data-poi-id="${escapeHtml(poi.id)}">
          <span>${escapeHtml(match[1])}</span>
          ${note ? `<small>${escapeHtml(note)}</small>` : ""}
        </button>
      `;
    })
    .filter(Boolean);
  if (items.length === 0) return "";
  return `
    <section class="pyramid-poi-related">
      <h3>相关地点</h3>
      <div>${items.join("")}</div>
    </section>
  `;
}

function renderPoiDetailMarkdown(poi: PoiEntry): string {
  const lines = (poi.detail || poi.summary || "暂无详细介绍。").split("\n");
  const sections = [...(poi.detailSections ?? [])];
  let sectionIndex = 0;
  const out: string[] = [];
  let paragraph: string[] = [];
  let skipUntilNextH2 = false;
  let relatedLines: string[] | null = null;

  function flushParagraph(): void {
    const text = paragraph.join(" ").replace(/\s+/g, " ").trim();
    if (text) out.push(`<p>${renderInlineMarkdownHtml(text, poi)}</p>`);
    paragraph = [];
  }

  function flushRelated(): void {
    if (!relatedLines) return;
    const html = renderRelatedPoiBlock(relatedLines, poi);
    if (html) out.push(html);
    relatedLines = null;
  }

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const heading = line.match(/^(#{1,6})\s+(.+)$/);
    if (heading) {
      flushRelated();
      flushParagraph();
      const title = stripPoiInlineMarkdown(heading[2]);
      const rawLevel = heading[1].length;
      const section = sections[sectionIndex++];
      if (rawLevel === 1) {
        skipUntilNextH2 = false;
        continue;
      }
      if (rawLevel === 2 && title === "一句话") {
        skipUntilNextH2 = true;
        continue;
      }
      skipUntilNextH2 = false;
      if (/^相关\s*POI|^相关地点/.test(title)) {
        relatedLines = [];
        continue;
      }
      const level = Math.min(Math.max(rawLevel + 1, 3), 5);
      const anchor = section?.anchor ?? `section-${sectionIndex}`;
      out.push(`<h${level} id="${escapeHtml(anchor)}" data-section-id="${escapeHtml(anchor)}">${escapeHtml(title)}</h${level}>`);
      continue;
    }
    if (skipUntilNextH2) continue;
    if (relatedLines) {
      relatedLines.push(line);
      continue;
    }
    if (isMarkdownTableStart(lines, index)) {
      flushParagraph();
      const tableLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith("|")) {
        tableLines.push(lines[index]);
        index++;
      }
      index--;
      out.push(renderMarkdownTable(tableLines, poi));
      continue;
    }
    if (!line.trim()) {
      flushParagraph();
      continue;
    }
    paragraph.push(line.trim());
  }
  flushRelated();
  flushParagraph();
  return out.join("");
}

function taxonomyItemsFromPois(
  key: "region" | "tangNavGroup",
  labelKey: "regionName" | "tangNavGroup"
): { id: string; name: string; order: number }[] {
  return [...new Map(POI_REGISTRY.map((poi) => {
    const id = poi[key] || "uncategorized";
    return [id, {
      id,
      name: labelKey === "regionName" ? poi.regionName : id,
      order: key === "region" ? poi.regionOrder : 999
    }];
  })).values()];
}

function taxonomyKindsFromPois(): { id: string; name: string; order: number }[] {
  return [...new Map(POI_REGISTRY.map((poi) => [poi.kind, {
    id: poi.kind,
    name: poi.kindName,
    order: poi.kindOrder
  }])).values()];
}

function groupedPoiIndexHtml(activePoi: PoiEntry, mode: PoiIndexMode): string {
  const regionItems = POI_TAXONOMY.regions.length
    ? POI_TAXONOMY.regions
    : taxonomyItemsFromPois("region", "regionName");
  const adminItems = POI_TAXONOMY.tangNavGroups.length
    ? POI_TAXONOMY.tangNavGroups
    : taxonomyItemsFromPois("tangNavGroup", "tangNavGroup");
  const kindItems = POI_TAXONOMY.kinds.length
    ? POI_TAXONOMY.kinds
    : taxonomyKindsFromPois();
  const primaryItems = mode === "geo" ? regionItems : adminItems;
  const primaryKey = mode === "geo" ? "region" : "tangNavGroup";

  return primaryItems
    .map((item) => {
      const itemPois = POI_REGISTRY.filter((poi) => poi[primaryKey] === item.id);
      if (itemPois.length === 0) return "";
      const itemOpen = itemPois.some((poi) => poi.id === activePoi.id);
      const kindHtml = kindItems
        .map((kind) => {
          const pois = itemPois
            .filter((poi) => poi.kind === kind.id)
            .slice()
            .sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN"));
          if (pois.length === 0) return "";
          const poiButtons = pois.map((poi) => `
            <button class="pyramid-poi-index-poi${poi.id === activePoi.id ? " pyramid-poi-index-poi-active" : ""}" data-poi-id="${escapeHtml(poi.id)}" type="button">
              <span>${escapeHtml(poi.name)}</span>
            </button>
          `).join("");
          return `
            <div class="pyramid-poi-index-kind">
              <div class="pyramid-poi-index-kind-title">${escapeHtml(kind.name)}</div>
              ${poiButtons}
            </div>
          `;
        })
        .join("");
      return `
        <details class="pyramid-poi-index-region" ${itemOpen ? "open" : ""}>
          <summary>${escapeHtml(item.name)}<span>${itemPois.length}</span></summary>
          ${kindHtml}
        </details>
      `;
    })
    .join("");
}

function sectionNavHtml(poi: PoiEntry): string {
  const sections = (poi.detailSections ?? []).filter((section) =>
    section.level === 2 &&
    section.title !== "一句话" &&
    !/^相关\s*POI/.test(section.title)
  );
  if (sections.length === 0) return "";
  return `
    <nav class="pyramid-poi-section-nav">
      ${sections.map((section) => `
        <button type="button" data-section-anchor="${escapeHtml(section.anchor)}">${escapeHtml(section.title)}</button>
      `).join("")}
    </nav>
  `;
}

export function buildPyramidPoiHoverHtml(poi: PoiEntry): string {
  const summary = truncatePoiText(poi.summary, 96);
  return `
    <div class="pyramid-poi-card-seal">${escapeHtml(categoryLabel(poi.category))}</div>
    <div class="pyramid-poi-card-title">${escapeHtml(poi.name)}</div>
    <div class="pyramid-poi-card-meta"><span>所处位置</span><strong>${escapeHtml(formatPoiLocation(poi))}</strong></div>
    <div class="pyramid-poi-card-meta"><span>始建年代</span><strong>${escapeHtml(foundedText(poi))}</strong></div>
    <div class="pyramid-poi-card-meta"><span>海拔</span><strong>${escapeHtml(elevationText(poi))}</strong></div>
    <p>${escapeHtml(summary)}</p>
    <div class="pyramid-poi-card-hint">按 I 查看详细信息</div>
  `;
}

export function buildPyramidPoiDetailHtml(poi: PoiEntry, indexMode: PoiIndexMode = "geo"): string {
  const summary = stripPoiMarkdown(poi.summary || "");
  const detail = renderPoiDetailMarkdown(poi);
  const indexModeLabel = indexMode === "geo" ? "地理分区" : "唐制行政";
  return `
    <div class="pyramid-poi-modal">
      <aside class="pyramid-poi-index">
        <div class="pyramid-poi-index-title">长安三万里</div>
        <div class="pyramid-poi-index-tabs" role="tablist" aria-label="POI 目录分类方式">
          <button class="${indexMode === "geo" ? "pyramid-poi-index-tab-active" : ""}" type="button" data-poi-index-mode="geo" aria-selected="${indexMode === "geo"}">地理</button>
          <button class="${indexMode === "admin" ? "pyramid-poi-index-tab-active" : ""}" type="button" data-poi-index-mode="admin" aria-selected="${indexMode === "admin"}">唐制</button>
        </div>
        <div class="pyramid-poi-index-mode">${escapeHtml(indexModeLabel)} · 类型 · 地点</div>
        ${groupedPoiIndexHtml(poi, indexMode)}
      </aside>
      <main class="pyramid-poi-reader">
        <button class="pyramid-poi-detail-close" type="button" data-poi-close="true" aria-label="关闭">×</button>
        <div class="pyramid-poi-detail-kicker">${escapeHtml(poi.regionName)} · ${escapeHtml(poi.kindName)} · ${escapeHtml(sourceQualityLabel(poi.sourceQuality))}</div>
        <h2>${escapeHtml(poi.name)}</h2>
        <dl class="pyramid-poi-facts">
          <div><dt>所处位置</dt><dd><strong>${escapeHtml(poi.subregionName)}</strong><span>${escapeHtml(formatPoiLocation(poi))}</span></dd></div>
          <div><dt>唐制归属</dt><dd><strong>${escapeHtml(formatTangLabel(poi.tangDaoName, poi.tangDao))}</strong><span>${escapeHtml(formatTangLabel(poi.tangAdminName, poi.tangAdmin))}</span></dd></div>
          <div><dt>始建年代</dt><dd>${escapeHtml(foundedText(poi))}</dd></div>
          <div><dt>海拔</dt><dd>${escapeHtml(elevationText(poi))}</dd></div>
        </dl>
        <section class="pyramid-poi-summary">
          <p>${escapeHtml(summary)}</p>
        </section>
        <div class="pyramid-poi-reader-body">
          ${sectionNavHtml(poi)}
          <article class="pyramid-poi-article">
            ${detail}
          </article>
        </div>
      </main>
    </div>
  `;
}

function ensurePyramidPoiHudStyle(): void {
  if (document.getElementById("pyramid-poi-hud-style")) return;
  const style = document.createElement("style");
  style.id = "pyramid-poi-hud-style";
  style.textContent = `
    .pyramid-poi-card {
      position: fixed;
      left: 18px;
      top: 18px;
      z-index: 12;
      width: min(320px, calc(100vw - 40px));
      box-sizing: border-box;
      transform: translateY(0);
      padding: 14px 16px 12px;
      color: #2b2418;
      pointer-events: none;
      background:
        linear-gradient(180deg, rgba(255, 250, 232, 0.95), rgba(231, 211, 163, 0.92));
      border: 1px solid rgba(107, 64, 28, 0.36);
      border-radius: 2px;
      box-shadow: 0 12px 34px rgba(20, 14, 8, 0.28), inset 0 0 0 1px rgba(255,255,255,0.42);
      font-family: "Songti SC", "STSong", "Noto Serif CJK SC", serif;
      opacity: 1;
      transition: opacity 160ms ease, transform 160ms ease;
    }
    .pyramid-poi-card::before,
    .pyramid-poi-card::after {
      content: "";
      position: absolute;
      left: 12px;
      right: 12px;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(104, 54, 23, 0.42), transparent);
    }
    .pyramid-poi-card::before { top: 7px; }
    .pyramid-poi-card::after { bottom: 7px; }
    .pyramid-poi-card-hidden {
      opacity: 0;
      transform: translateY(8px);
    }
    .pyramid-poi-card-seal {
      float: right;
      min-width: 28px;
      padding: 3px 4px;
      color: #f8ead2;
      background: #8f2f22;
      border-radius: 1px;
      text-align: center;
      font-size: 10px;
      line-height: 1.1;
      letter-spacing: 0;
      writing-mode: vertical-rl;
    }
    .pyramid-poi-card-title {
      margin-right: 42px;
      font-size: 18px;
      font-weight: 700;
      line-height: 1.25;
      color: #21180f;
    }
    .pyramid-poi-card-meta {
      display: flex;
      gap: 10px;
      justify-content: space-between;
      margin-top: 7px;
      font-size: 12px;
      line-height: 1.35;
      color: rgba(43, 36, 24, 0.76);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .pyramid-poi-card-meta strong {
      max-width: 190px;
      color: rgba(43, 36, 24, 0.92);
      font-weight: 600;
      text-align: right;
    }
    .pyramid-poi-card p {
      clear: both;
      margin: 10px 0 0;
      font-size: 13px;
      line-height: 1.65;
    }
    .pyramid-poi-card-hint {
      margin-top: 9px;
      font-size: 11px;
      color: rgba(143, 47, 34, 0.86);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .pyramid-poi-detail {
      position: fixed;
      inset: 34px 42px;
      z-index: 13;
      width: auto;
      height: auto;
      box-sizing: border-box;
      padding: 0;
      overflow: hidden;
      color: #271f15;
      background:
        linear-gradient(90deg, rgba(76, 36, 18, 0.12), transparent 22%),
        linear-gradient(180deg, #f8efd9, #e4c987);
      border-radius: 6px;
      box-shadow: 0 0 0 1px rgba(91, 52, 21, 0.2), 0 18px 80px rgba(12, 8, 4, 0.4);
      opacity: 1;
      transform: translateY(0);
      transition: opacity 180ms ease, transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
      font-family: "Songti SC", "STSong", "Noto Serif CJK SC", serif;
    }
    .pyramid-poi-detail-hidden {
      opacity: 0;
      pointer-events: none;
      transform: translateY(12px);
    }
    .pyramid-poi-modal {
      display: grid;
      grid-template-columns: 220px minmax(0, 1fr);
      height: 100%;
      min-height: 0;
    }
    .pyramid-poi-index {
      overflow: auto;
      scrollbar-width: thin;
      padding: 20px 12px 24px;
      background:
        linear-gradient(180deg, rgba(59, 35, 19, 0.92), rgba(31, 22, 14, 0.94)),
        #302017;
      color: #f7e8c8;
      border-right: 1px solid rgba(255, 232, 184, 0.22);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .pyramid-poi-index::-webkit-scrollbar,
    .pyramid-poi-reader::-webkit-scrollbar {
      width: 6px;
    }
    .pyramid-poi-index::-webkit-scrollbar-track,
    .pyramid-poi-reader::-webkit-scrollbar-track {
      background: transparent;
    }
    .pyramid-poi-index::-webkit-scrollbar-thumb {
      background: rgba(246, 217, 157, 0.22);
      border-radius: 999px;
    }
    .pyramid-poi-reader::-webkit-scrollbar-thumb {
      background: rgba(107, 45, 32, 0.22);
      border-radius: 999px;
    }
    .pyramid-poi-index-title {
      margin: 0 0 14px;
      color: #f6d99d;
      font-family: "Songti SC", "STSong", "Noto Serif CJK SC", serif;
      font-size: 20px;
      font-weight: 700;
      line-height: 1.2;
    }
    .pyramid-poi-index-mode {
      margin: 10px 0 8px;
      padding: 0 2px;
      color: rgba(255, 245, 220, 0.74);
      font-size: 11px;
      font-weight: 750;
      letter-spacing: 0.04em;
    }
    .pyramid-poi-index-tabs {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 4px;
      margin: 0 0 12px;
      padding: 3px;
      background: rgba(12, 8, 5, 0.26);
      border: 1px solid rgba(246, 217, 157, 0.14);
      border-radius: 4px;
    }
    .pyramid-poi-index-tabs button {
      min-width: 0;
      padding: 6px 4px;
      color: rgba(255, 245, 220, 0.68);
      background: transparent;
      border: 0;
      border-radius: 2px;
      cursor: pointer;
      font: 12px/1.2 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .pyramid-poi-index-tabs button:hover,
    .pyramid-poi-index-tabs .pyramid-poi-index-tab-active {
      color: #fff6dc;
      background: rgba(180, 55, 42, 0.42);
    }
    .pyramid-poi-index-region {
      border-top: 1px solid rgba(246, 217, 157, 0.18);
    }
    .pyramid-poi-index-region summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 10px 2px;
      cursor: pointer;
      color: #f2dfb7;
      font-size: 13px;
      font-weight: 700;
      list-style: none;
    }
    .pyramid-poi-index-region summary::-webkit-details-marker {
      display: none;
    }
    .pyramid-poi-index-region summary span {
      color: rgba(242, 223, 183, 0.58);
      font-size: 12px;
      font-weight: 500;
    }
    .pyramid-poi-index-kind {
      margin: 0 0 10px 8px;
    }
    .pyramid-poi-index-kind-title {
      margin: 4px 0 5px;
      color: rgba(246, 217, 157, 0.62);
      font-size: 11px;
      font-weight: 700;
    }
    .pyramid-poi-index-poi {
      display: grid;
      grid-template-columns: minmax(0, 1fr);
      align-items: baseline;
      width: 100%;
      margin: 0;
      padding: 6px 7px;
      color: rgba(255, 245, 220, 0.82);
      background: transparent;
      border: 0;
      border-radius: 2px;
      text-align: left;
      cursor: pointer;
      font: 12px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .pyramid-poi-index-poi:hover,
    .pyramid-poi-index-poi-active {
      color: #fff6dc;
      background: rgba(180, 55, 42, 0.36);
    }
    .pyramid-poi-index-poi span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .pyramid-poi-reader {
      position: relative;
      overflow: auto;
      scrollbar-width: thin;
      padding: 34px min(6vw, 68px) 56px 40px;
    }
    .pyramid-poi-detail-close {
      position: sticky;
      top: 0;
      float: right;
      width: 34px;
      height: 34px;
      border: 1px solid rgba(91, 52, 21, 0.26);
      border-radius: 50%;
      color: #6b2d20;
      background: rgba(248, 239, 217, 0.82);
      cursor: pointer;
      font: 22px/1 "Times New Roman", serif;
    }
    .pyramid-poi-detail-kicker {
      color: #8f2f22;
      font: 12px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .pyramid-poi-detail h2 {
      margin: 8px 0 18px;
      font-size: clamp(30px, 4.2vw, 58px);
      line-height: 1.2;
    }
    .pyramid-poi-detail h3 {
      margin: 32px 0 12px;
      color: #5e3118;
      font-size: 22px;
    }
    .pyramid-poi-detail h4 {
      margin: 26px 0 10px;
      color: #6d3b1f;
      font-size: 18px;
    }
    .pyramid-poi-detail h5 {
      margin: 20px 0 8px;
      color: #7a492a;
      font-size: 15px;
    }
    .pyramid-poi-facts {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 12px;
      margin: 0 0 18px;
      padding: 14px 0;
      border-top: 1px solid rgba(91, 52, 21, 0.2);
      border-bottom: 1px solid rgba(91, 52, 21, 0.2);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .pyramid-poi-facts div {
      display: grid;
      gap: 5px;
      min-width: 0;
    }
    .pyramid-poi-facts dt {
      color: rgba(39, 31, 21, 0.62);
      font-size: 12px;
    }
    .pyramid-poi-facts dd {
      margin: 0;
      color: rgba(39, 31, 21, 0.92);
      font-size: 15px;
      font-weight: 650;
      line-height: 1.5;
    }
    .pyramid-poi-facts dd strong,
    .pyramid-poi-facts dd span {
      display: block;
    }
    .pyramid-poi-facts dd span {
      color: rgba(39, 31, 21, 0.68);
      font-size: 13px;
      font-weight: 500;
    }
    .pyramid-poi-summary {
      max-width: 880px;
      margin: 18px 0 18px;
      color: #402918;
      font-weight: 700;
    }
    .pyramid-poi-section-nav {
      position: sticky;
      top: 18px;
      align-self: start;
      display: grid;
      gap: 2px;
      margin: 8px 0 0;
      padding: 4px 0 0 12px;
      border-left: 1px solid rgba(91, 52, 21, 0.18);
    }
    .pyramid-poi-section-nav button {
      padding: 5px 0;
      color: rgba(91, 52, 21, 0.7);
      background: transparent;
      border: 0;
      border-radius: 0;
      cursor: pointer;
      text-align: left;
      font: 12px/1.35 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .pyramid-poi-section-nav button:hover {
      color: #8f2f22;
    }
    .pyramid-poi-article {
      max-width: 850px;
      min-width: 0;
    }
    .pyramid-poi-reader-body {
      display: grid;
      grid-template-columns: minmax(118px, 16%) minmax(0, 1fr);
      gap: 28px;
      align-items: start;
    }
    .pyramid-poi-detail p {
      margin: 0 0 12px;
      font-size: 15px;
      line-height: 1.82;
    }
    .pyramid-poi-markdown-table {
      width: 100%;
      margin: 14px 0 22px;
      border-collapse: collapse;
      font: 13px/1.55 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .pyramid-poi-markdown-table th,
    .pyramid-poi-markdown-table td {
      padding: 9px 10px;
      border: 1px solid rgba(91, 52, 21, 0.18);
      vertical-align: top;
      text-align: left;
    }
    .pyramid-poi-markdown-table th {
      color: #5e3118;
      background: rgba(107, 45, 32, 0.08);
      font-weight: 700;
    }
    .pyramid-poi-inline-link,
    .pyramid-poi-related-link {
      color: #8f2f22;
      background: transparent;
      border: 0;
      cursor: pointer;
      font: inherit;
      text-align: left;
      padding: 0;
    }
    .pyramid-poi-inline-link:hover,
    .pyramid-poi-related-link:hover span {
      text-decoration: underline;
    }
    .pyramid-poi-related {
      margin-top: 30px;
      padding-top: 18px;
      border-top: 1px solid rgba(91, 52, 21, 0.18);
    }
    .pyramid-poi-related h3 {
      margin-top: 0;
    }
    .pyramid-poi-related div {
      display: grid;
      gap: 9px;
    }
    .pyramid-poi-related-link {
      display: grid;
      gap: 2px;
      color: #6b2d20;
    }
    .pyramid-poi-related-link span {
      color: #8f2f22;
      font-weight: 700;
    }
    .pyramid-poi-related-link small {
      color: rgba(39, 31, 21, 0.62);
      font-size: 12px;
      line-height: 1.45;
    }
    @media (max-width: 760px) {
      .pyramid-poi-detail {
        inset: 16px;
      }
      .pyramid-poi-modal {
        grid-template-columns: 1fr;
        grid-template-rows: 30vh 1fr;
      }
      .pyramid-poi-reader {
        padding: 24px 20px 54px;
      }
      .pyramid-poi-reader-body {
        grid-template-columns: 1fr;
      }
      .pyramid-poi-section-nav {
        position: static;
        display: flex;
        flex-wrap: wrap;
        border-left: 0;
        padding-left: 0;
      }
      .pyramid-poi-detail dl {
        grid-template-columns: 1fr;
      }
    }
  `;
  document.head.appendChild(style);
}

export function createPyramidPoiHud(parent: HTMLElement = document.body): PyramidPoiHud {
  ensurePyramidPoiHudStyle();
  const hoverCard = document.createElement("div");
  hoverCard.className = "pyramid-poi-card pyramid-poi-card-hidden";
  const detail = document.createElement("aside");
  detail.className = "pyramid-poi-detail pyramid-poi-detail-hidden";
  parent.append(hoverCard, detail);

  let target: PoiEntry | null = null;
  let hoverPointer: PoiHoverPointer | null = null;
  let detailOpen = false;
  let indexMode: PoiIndexMode = "geo";

  function positionHoverCard(): void {
    if (!hoverPointer || detailOpen || hoverCard.classList.contains("pyramid-poi-card-hidden")) return;
    const offset = 16;
    const margin = 12;
    const rect = hoverCard.getBoundingClientRect();
    const width = rect.width || 320;
    const height = rect.height || 180;
    let left = hoverPointer.clientX + offset;
    let top = hoverPointer.clientY + offset;
    if (left + width + margin > window.innerWidth) {
      left = hoverPointer.clientX - width - offset;
    }
    if (top + height + margin > window.innerHeight) {
      top = hoverPointer.clientY - height - offset;
    }
    left = Math.max(margin, Math.min(left, window.innerWidth - width - margin));
    top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));
    hoverCard.style.left = `${Math.round(left)}px`;
    hoverCard.style.top = `${Math.round(top)}px`;
  }

  function sync(): void {
    hoverCard.classList.toggle("pyramid-poi-card-hidden", !target || detailOpen);
    detail.classList.toggle("pyramid-poi-detail-hidden", !target || !detailOpen);
    hoverCard.innerHTML = target && !detailOpen ? buildPyramidPoiHoverHtml(target) : "";
    detail.innerHTML = target && detailOpen ? buildPyramidPoiDetailHtml(target, indexMode) : "";
    positionHoverCard();
  }

  document.addEventListener("pointerdown", (event) => {
    if (!detailOpen) return;
    if (event.target instanceof Node && detail.contains(event.target)) return;
    detailOpen = false;
    sync();
  });
  detail.addEventListener("click", (event) => {
    if (!(event.target instanceof HTMLElement)) return;
    if (event.target.closest("[data-poi-close]")) {
      detailOpen = false;
      sync();
      return;
    }
    const modeButton = event.target.closest<HTMLElement>("[data-poi-index-mode]");
    if (modeButton?.dataset.poiIndexMode === "geo" || modeButton?.dataset.poiIndexMode === "admin") {
      indexMode = modeButton.dataset.poiIndexMode;
      sync();
      return;
    }
    const poiButton = event.target.closest<HTMLElement>("[data-poi-id]");
    if (poiButton?.dataset.poiId) {
      const nextPoi = POI_REGISTRY.find((poi) => poi.id === poiButton.dataset.poiId);
      if (nextPoi) {
        target = nextPoi;
        detailOpen = true;
        sync();
      }
      return;
    }
    const sectionButton = event.target.closest<HTMLElement>("[data-section-anchor]");
    const sectionAnchor = sectionButton?.dataset.sectionAnchor;
    if (sectionAnchor) {
      detail
        .querySelector<HTMLElement>(`[data-section-id="${CSS.escape(sectionAnchor)}"]`)
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  });

  sync();

  return {
    setHoverTarget(poi, pointer) {
      if (detailOpen) return;
      if (pointer) hoverPointer = pointer;
      if (!poi) hoverPointer = null;
      if (target?.id !== poi?.id) detailOpen = false;
      target = poi;
      sync();
    },
    showDetail(poi) {
      target = poi;
      detailOpen = true;
      sync();
    },
    toggleDetail() {
      if (!target) return;
      detailOpen = !detailOpen;
      sync();
    },
    hideDetail() {
      detailOpen = false;
      sync();
    },
    currentPoi() {
      return target;
    }
  };
}
