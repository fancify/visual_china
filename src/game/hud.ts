import type { ViewMode } from "../data/qinlingSlice";
import { modeMeta, viewModes } from "../data/qinlingSlice";
import { compactHudPanelConfig } from "./hudChrome.js";

export interface HudStatusSnapshot {
  zone: string;
  mode: string;
  environment: string;
  collection: string;
  nearby: string;
  story: string;
}

export interface HudController {
  overviewCanvas: HTMLCanvasElement;
  closeJournalButton: HTMLButtonElement;
  journal: HTMLElement;
  journalEmpty: HTMLElement;
  journalList: HTMLElement;
  journalDetail: HTMLElement;
  setLoadingState(message: string, tone?: "info" | "success" | "error"): void;
  setActiveMode(mode: ViewMode): void;
  updateStatus(snapshot: HudStatusSnapshot): void;
  showToast(text: string): void;
  hideToast(): void;
}

const defaultStatusSnapshot: HudStatusSnapshot = {
  zone: "地带：关中平原",
  mode: `视图：${modeMeta.terrain.title}`,
  environment: "时辰：07:30 · 春 · 晴",
  collection: "残简：0 / 0",
  nearby: "附近：风从平原吹向山前。",
  story: "主线：从关中出发，去看山河如何一步步把道路收紧。"
};

function requireElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);

  if (!element) {
    throw new Error(`Missing HUD element: ${selector}`);
  }

  return element;
}

export function createHud(
  app: HTMLElement,
  initialLoadingLabel: string,
  fragmentCount: number
): HudController {
  const hud = document.createElement("div");
  hud.className = "hud";
  hud.innerHTML = `
    <div class="title-block">
      <div class="eyebrow">山河中国 · 垂直切片原型</div>
      <h1>秦岭 - 关中 - 四川盆地</h1>
      <p>风景先出现，理解随后被拾起。</p>
      <div class="loading-line" id="loading-line"></div>
    </div>
    <details class="mode-block hud-drawer" ${compactHudPanelConfig.mode.openByDefault ? "open" : ""}>
      <summary>视图 · <strong id="mode-summary">${modeMeta.terrain.title}</strong></summary>
      <div class="mode-options">
        ${viewModes
          .map(
            (mode, index) => `
              <div class="mode-chip ${mode === "terrain" ? "active" : ""}" data-mode="${mode}">
                <span>${index + 1}</span>
                <strong>${modeMeta[mode].title}</strong>
              </div>
            `
          )
          .join("")}
      </div>
    </details>
    <div class="status-block ${compactHudPanelConfig.status.openByDefault ? "visible" : ""}">
      <div class="status-title">当前旅程</div>
      <div class="status-line" id="zone-line">${defaultStatusSnapshot.zone}</div>
      <div class="status-line story-line" id="story-line">${defaultStatusSnapshot.story}</div>
      <details class="status-extra hud-drawer">
        <summary>更多状态</summary>
        <div class="status-line" id="mode-line">${defaultStatusSnapshot.mode}</div>
        <div class="status-line" id="environment-line">${defaultStatusSnapshot.environment}</div>
        <div class="status-line" id="collection-line">残简：0 / ${fragmentCount}</div>
        <div class="status-line" id="nearby-line">${defaultStatusSnapshot.nearby}</div>
      </details>
    </div>
    <details class="overview-block hud-drawer" ${compactHudPanelConfig.overview.openByDefault ? "open" : ""}>
      <summary>地貌总览</summary>
      <canvas id="overview-map" width="220" height="270"></canvas>
      <div class="overview-legend">
        <span>北：关中</span>
        <span>中：秦岭</span>
        <span>南：汉中 / 巴蜀</span>
      </div>
    </details>
    <details class="controls-block hud-drawer" ${compactHudPanelConfig.controls.openByDefault ? "open" : ""}>
      <summary>操作提示</summary>
      <div class="control-grid">
        <span>WASD 移动</span>
        <span>拖动 / Q E 转向</span>
        <span>滚轮缩放</span>
        <span>O 总览 / F 近身</span>
        <span>1-4 切换视图</span>
        <span>T 快进时辰</span>
        <span>K 切天气</span>
        <span>L 切季节</span>
        <span>J 打开札记</span>
        <span>点击画面启用声音</span>
      </div>
    </details>
    <div class="toast" id="pickup-toast"></div>
    <aside class="journal" id="journal">
      <div class="journal-head">
        <div>
          <div class="eyebrow">山河札记</div>
          <h2>拾起的残简</h2>
        </div>
        <button id="close-journal" type="button">收起</button>
      </div>
      <div class="journal-empty" id="journal-empty">山路上还没有拾起新的残简。</div>
      <div class="journal-body">
        <div class="journal-list" id="journal-list"></div>
        <div class="journal-detail" id="journal-detail"></div>
      </div>
    </aside>
  `;
  app.appendChild(hud);

  const loadingLine = requireElement<HTMLElement>(hud, "#loading-line");
  const pickupToast = requireElement<HTMLElement>(hud, "#pickup-toast");
  const zoneLine = requireElement<HTMLElement>(hud, "#zone-line");
  const modeLine = requireElement<HTMLElement>(hud, "#mode-line");
  const environmentLine = requireElement<HTMLElement>(hud, "#environment-line");
  const collectionLine = requireElement<HTMLElement>(hud, "#collection-line");
  const nearbyLine = requireElement<HTMLElement>(hud, "#nearby-line");
  const storyLine = requireElement<HTMLElement>(hud, "#story-line");
  const modeSummary = requireElement<HTMLElement>(hud, "#mode-summary");
  const overviewCanvas = requireElement<HTMLCanvasElement>(hud, "#overview-map");
  const journal = requireElement<HTMLElement>(hud, "#journal");
  const journalEmpty = requireElement<HTMLElement>(hud, "#journal-empty");
  const journalList = requireElement<HTMLElement>(hud, "#journal-list");
  const journalDetail = requireElement<HTMLElement>(hud, "#journal-detail");
  const closeJournalButton = requireElement<HTMLButtonElement>(
    hud,
    "#close-journal"
  );

  const modeChips = new Map<ViewMode, HTMLElement>();

  viewModes.forEach((mode) => {
    const chip = requireElement<HTMLElement>(hud, `.mode-chip[data-mode="${mode}"]`);
    modeChips.set(mode, chip);
  });

  let lastStatus: HudStatusSnapshot | null = null;

  const controller: HudController = {
    overviewCanvas,
    closeJournalButton,
    journal,
    journalEmpty,
    journalList,
    journalDetail,
    setLoadingState(message, tone = "info") {
      loadingLine.textContent = message;
      loadingLine.classList.remove("success", "error");

      if (tone !== "info") {
        loadingLine.classList.add(tone);
      }
    },
    setActiveMode(mode) {
      modeSummary.textContent = modeMeta[mode].title;
      modeChips.forEach((chip, chipMode) => {
        chip.classList.toggle("active", chipMode === mode);
      });
    },
    updateStatus(snapshot) {
      if (lastStatus?.zone !== snapshot.zone) {
        zoneLine.textContent = snapshot.zone;
      }
      if (lastStatus?.mode !== snapshot.mode) {
        modeLine.textContent = snapshot.mode;
      }
      if (lastStatus?.environment !== snapshot.environment) {
        environmentLine.textContent = snapshot.environment;
      }
      if (lastStatus?.collection !== snapshot.collection) {
        collectionLine.textContent = snapshot.collection;
      }
      if (lastStatus?.nearby !== snapshot.nearby) {
        nearbyLine.textContent = snapshot.nearby;
      }
      if (lastStatus?.story !== snapshot.story) {
        storyLine.textContent = snapshot.story;
      }

      lastStatus = snapshot;
    },
    showToast(text) {
      pickupToast.textContent = text;
      pickupToast.classList.add("visible");
    },
    hideToast() {
      pickupToast.classList.remove("visible");
    }
  };

  controller.setLoadingState(`正在载入母版：${initialLoadingLabel}`);
  controller.setActiveMode("terrain");
  controller.updateStatus({
    ...defaultStatusSnapshot,
    collection: `残简：0 / ${fragmentCount}`
  });

  return controller;
}
