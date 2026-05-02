import type { ViewMode } from "../data/qinlingSlice";
import { modeMeta, viewModes } from "../data/qinlingSlice";
import { compactHudPanelConfig } from "./hudChrome.js";
import type {
  QinlingAtlasFeature,
  QinlingAtlasLayer,
  QinlingAtlasLayerId
} from "./qinlingAtlas.js";

export interface HudStatusSnapshot {
  zone: string;
  mode: string;
  environment: string;
  collection: string;
  nearby: string;
  story: string;
}

export interface HudCompassSnapshot {
  northAngleRadians: number;
  screenRightDirection: string;
}

export interface AtlasLayerCount {
  layerId: QinlingAtlasLayerId;
  layerName: string;
  count: number;
}

export interface AtlasSummary {
  layerCounts: AtlasLayerCount[];
  totalFeatures: number;
  evidenceLoaded: boolean;
}

export interface HudController {
  overviewCanvas: HTMLCanvasElement;
  atlasFullscreen: HTMLElement;
  atlasFullscreenCanvas: HTMLCanvasElement;
  atlasLayerList: HTMLElement;
  atlasFullscreenLayerList: HTMLElement;
  atlasFeatureCard: HTMLElement;
  atlasFullscreenFeatureCard: HTMLElement;
  openAtlasFullscreenButton: HTMLButtonElement;
  closeAtlasFullscreenButton: HTMLButtonElement;
  closeJournalButton: HTMLButtonElement;
  journal: HTMLElement;
  journalEmpty: HTMLElement;
  journalList: HTMLElement;
  journalDetail: HTMLElement;
  setLoadingState(message: string, tone?: "info" | "success" | "error"): void;
  setActiveMode(mode: ViewMode): void;
  renderAtlasLayers(
    layers: QinlingAtlasLayer[],
    visibleLayerIds: Set<QinlingAtlasLayerId>
  ): void;
  renderAtlasFeature(feature: QinlingAtlasFeature | null): void;
  renderAtlasSummary(summary: AtlasSummary | null): void;
  setAtlasFullscreenOpen(isOpen: boolean): void;
  updateCompass(snapshot: HudCompassSnapshot): void;
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
  const hiddenClass = "hud-hidden";
  hud.className = "hud";
  hud.innerHTML = `
    <div class="title-block">
      <div class="eyebrow">山河中国</div>
      <h1>秦岭 - 关中 - 四川盆地</h1>
      <div class="loading-line" id="loading-line"></div>
    </div>
    <div class="compass-block" aria-label="游戏方位">
      <div class="compass-dial">
        <span class="compass-cardinal compass-north">北</span>
        <span class="compass-cardinal compass-east">东</span>
        <span class="compass-needle" id="compass-needle"></span>
      </div>
      <div class="compass-copy">
        <span>屏幕右侧</span>
        <strong id="compass-direction">东</strong>
      </div>
    </div>
    <details class="mode-block hud-drawer ${compactHudPanelConfig.mode.visible ? "" : hiddenClass}" ${compactHudPanelConfig.mode.openByDefault ? "open" : ""}>
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
    <div class="status-block ${compactHudPanelConfig.status.visible ? "" : hiddenClass} ${compactHudPanelConfig.status.openByDefault ? "visible" : ""}">
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
    <details class="overview-block hud-drawer ${compactHudPanelConfig.overview.visible ? "" : hiddenClass}" ${compactHudPanelConfig.overview.openByDefault ? "open" : ""}>
      <summary>地图 · M</summary>
      <canvas id="overview-map" width="220" height="270"></canvas>
      <button class="atlas-open-button" id="open-atlas-fullscreen" type="button">
        全屏地图
      </button>
      <div class="atlas-layer-list" id="atlas-layer-list"></div>
      <div class="atlas-feature-card" id="atlas-feature-card">
        <div class="atlas-card-kicker">点击地图</div>
        <strong>选择一个地理要素</strong>
        <p>可以查看河流、古道、城市、关隘和地貌的解释。</p>
      </div>
      <div class="overview-legend">
        <span>北：关中</span>
        <span>中：秦岭</span>
        <span>南：汉中 / 巴蜀</span>
      </div>
    </details>
    <aside class="atlas-fullscreen" id="atlas-fullscreen" aria-hidden="true">
      <div class="atlas-fullscreen-shell">
        <header class="atlas-fullscreen-head">
          <div>
            <div class="eyebrow">区域 · 秦岭 - 关中 - 汉中 - 四川盆地</div>
            <h2>地貌总览</h2>
            <p id="atlas-fullscreen-subtitle">山、水、盆地与通行关系。</p>
          </div>
          <button id="close-atlas-fullscreen" type="button">返回游戏</button>
        </header>
        <div class="atlas-fullscreen-body">
          <div class="atlas-map-stage">
            <canvas id="atlas-fullscreen-map" width="840" height="1120"></canvas>
          </div>
          <aside class="atlas-side-panel">
            <div class="atlas-panel-section">
              <div class="atlas-panel-title">图层</div>
              <div class="atlas-layer-list atlas-layer-list-full" id="atlas-fullscreen-layer-list"></div>
            </div>
            <div class="atlas-panel-section">
              <div class="atlas-panel-title">要素说明</div>
              <div class="atlas-feature-card atlas-feature-card-full" id="atlas-fullscreen-feature-card">
                <div class="atlas-card-kicker">点击地图</div>
                <strong>选择一个地理要素</strong>
                <p>可以查看河流、古道、城市、关隘和地貌的解释。</p>
              </div>
            </div>
          </aside>
        </div>
      </div>
    </aside>
    <details class="controls-block hud-drawer ${compactHudPanelConfig.controls.visible ? "" : hiddenClass}" ${compactHudPanelConfig.controls.openByDefault ? "open" : ""}>
      <summary>操作提示</summary>
      <div class="control-grid">
        <span>WASD 移动</span>
        <span>拖动 / Q E 转向</span>
        <span>滚轮缩放</span>
        <span>O 总览 / F 近身</span>
        <span>M 全屏地图</span>
        <span>T 快进时辰</span>
        <span>K 切天气</span>
        <span>L 切季节</span>
        <span>点击画面启用声音</span>
      </div>
    </details>
    <div class="toast" id="pickup-toast"></div>
    <aside class="journal ${compactHudPanelConfig.journal.visible ? "" : hiddenClass}" id="journal">
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
  const compassNeedle = requireElement<HTMLElement>(hud, "#compass-needle");
  const compassDirection = requireElement<HTMLElement>(hud, "#compass-direction");
  const pickupToast = requireElement<HTMLElement>(hud, "#pickup-toast");
  const zoneLine = requireElement<HTMLElement>(hud, "#zone-line");
  const modeLine = requireElement<HTMLElement>(hud, "#mode-line");
  const environmentLine = requireElement<HTMLElement>(hud, "#environment-line");
  const collectionLine = requireElement<HTMLElement>(hud, "#collection-line");
  const nearbyLine = requireElement<HTMLElement>(hud, "#nearby-line");
  const storyLine = requireElement<HTMLElement>(hud, "#story-line");
  const modeSummary = requireElement<HTMLElement>(hud, "#mode-summary");
  const overviewCanvas = requireElement<HTMLCanvasElement>(hud, "#overview-map");
  const openAtlasFullscreenButton = requireElement<HTMLButtonElement>(
    hud,
    "#open-atlas-fullscreen"
  );
  const atlasFullscreen = requireElement<HTMLElement>(hud, "#atlas-fullscreen");
  const atlasFullscreenCanvas = requireElement<HTMLCanvasElement>(
    hud,
    "#atlas-fullscreen-map"
  );
  const atlasFullscreenSubtitle = requireElement<HTMLElement>(
    hud,
    "#atlas-fullscreen-subtitle"
  );
  const atlasLayerList = requireElement<HTMLElement>(hud, "#atlas-layer-list");
  const atlasFullscreenLayerList = requireElement<HTMLElement>(
    hud,
    "#atlas-fullscreen-layer-list"
  );
  const atlasFeatureCard = requireElement<HTMLElement>(hud, "#atlas-feature-card");
  const atlasFullscreenFeatureCard = requireElement<HTMLElement>(
    hud,
    "#atlas-fullscreen-feature-card"
  );
  const closeAtlasFullscreenButton = requireElement<HTMLButtonElement>(
    hud,
    "#close-atlas-fullscreen"
  );
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
  let lastCompass: HudCompassSnapshot | null = null;

  const renderLayerList = (
    container: HTMLElement,
    layers: QinlingAtlasLayer[],
    visibleLayerIds: Set<QinlingAtlasLayerId>
  ): void => {
    container.innerHTML = layers
      .map(
        (layer) => `
          <button
            class="atlas-layer-chip ${visibleLayerIds.has(layer.id) ? "active" : ""}"
            data-atlas-layer="${layer.id}"
            type="button"
            title="${layer.description}"
          >
            ${layer.name}
          </button>
        `
      )
      .join("");
  };

  let lastSummary: AtlasSummary | null = null;

  const renderSummaryCard = (
    container: HTMLElement,
    summary: AtlasSummary | null
  ): void => {
    if (!summary || summary.totalFeatures === 0) {
      container.innerHTML = `
        <div class="atlas-card-kicker">点击地图</div>
        <strong>选择一个地理要素</strong>
        <p>可以查看河流、古道、城市、关隘和地貌的解释。</p>
      `;
      return;
    }

    const counts = summary.layerCounts
      .filter((entry) => entry.count > 0)
      .map(
        (entry) =>
          `<span class="atlas-summary-row"><strong>${entry.count}</strong> ${entry.layerName}</span>`
      )
      .join("");
    const evidenceHint = summary.evidenceLoaded
      ? "已加载 OSM 详细水系（缩放足够）。"
      : "缩放到 1.45x 以上可加载 OSM 详细水系。";

    container.innerHTML = `
      <div class="atlas-card-kicker">当前可见</div>
      <strong>共 ${summary.totalFeatures} 个要素</strong>
      <div class="atlas-summary-grid">${counts}</div>
      <p class="atlas-summary-hint">点击地图上任意要素查看解释。${evidenceHint}</p>
    `;
  };

  const renderFeatureCard = (
    container: HTMLElement,
    feature: QinlingAtlasFeature | null
  ): void => {
    if (!feature) {
      renderSummaryCard(container, lastSummary);
      return;
    }

    // 区分"真实 GIS 数据"和"手画叙事意象"。前者来自 OSM/curated hydrography
    // 等可信源；后者是文献位置的视觉草稿（古道、关隘点位、地貌区域），
    // 用户必须能看出来不是事实数据。
    const verification = feature.source?.verification;
    const isVerified =
      verification === "external-vector" || verification === "verified";
    const isDraft = !isVerified;
    const sourceLabel = isDraft
      ? `<span class="atlas-source-draft">⚠ 手画叙事意象，待真实数据校准</span>`
      : `<span>来源：${feature.source?.name ?? "—"}（${verification}）</span>`;
    const nameSuffix = isDraft ? "<em class='atlas-name-draft'> · 意象</em>" : "";

    container.innerHTML = `
      <div class="atlas-card-kicker">${feature.layer} · ${feature.terrainRole}</div>
      <strong>${feature.name}${nameSuffix}</strong>
      <p>${feature.copy.summary}</p>
      ${sourceLabel}
      <span>视觉规则：${feature.visualRule.symbol} / ${feature.visualRule.emphasis}</span>
    `;
  };

  const controller: HudController = {
    overviewCanvas,
    atlasFullscreen,
    atlasFullscreenCanvas,
    atlasLayerList,
    atlasFullscreenLayerList,
    atlasFeatureCard,
    atlasFullscreenFeatureCard,
    openAtlasFullscreenButton,
    closeAtlasFullscreenButton,
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
    renderAtlasLayers(layers, visibleLayerIds) {
      renderLayerList(atlasLayerList, layers, visibleLayerIds);
      renderLayerList(atlasFullscreenLayerList, layers, visibleLayerIds);
    },
    renderAtlasFeature(feature) {
      renderFeatureCard(atlasFeatureCard, feature);
      renderFeatureCard(atlasFullscreenFeatureCard, feature);
    },
    renderAtlasSummary(summary) {
      lastSummary = summary;
      // 当没有 feature 选中时刷新摘要内容（renderFeatureCard 会读 lastSummary）
      renderFeatureCard(atlasFeatureCard, null);
      renderFeatureCard(atlasFullscreenFeatureCard, null);
      // 同步顶部副标题为动态摘要
      if (summary) {
        const parts = summary.layerCounts
          .filter((entry) => entry.count > 0)
          .slice(0, 4)
          .map((entry) => `${entry.count} ${entry.layerName}`);
        atlasFullscreenSubtitle.textContent =
          parts.length > 0
            ? parts.join("  ·  ") +
              (summary.evidenceLoaded ? "  ·  含 OSM 详细水系" : "")
            : "山、水、盆地与通行关系。";
      } else {
        atlasFullscreenSubtitle.textContent = "山、水、盆地与通行关系。";
      }
    },
    setAtlasFullscreenOpen(isOpen) {
      atlasFullscreen.classList.toggle("open", isOpen);
      atlasFullscreen.setAttribute("aria-hidden", String(!isOpen));
    },
    updateCompass(snapshot) {
      if (lastCompass?.northAngleRadians !== snapshot.northAngleRadians) {
        compassNeedle.style.transform =
          `translate(-50%, -100%) rotate(${snapshot.northAngleRadians}rad)`;
      }
      if (lastCompass?.screenRightDirection !== snapshot.screenRightDirection) {
        compassDirection.textContent = snapshot.screenRightDirection;
      }

      lastCompass = snapshot;
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
  controller.updateCompass({
    northAngleRadians: 0,
    screenRightDirection: "东"
  });
  controller.updateStatus({
    ...defaultStatusSnapshot,
    collection: `残简：0 / ${fragmentCount}`
  });

  return controller;
}
