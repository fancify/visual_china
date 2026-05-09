import type { ViewMode } from "../data/qinlingSlice";
import { modeMeta, viewModes } from "../data/qinlingSlice";
import { compactHudPanelConfig } from "./hudChrome.js";
import {
  AVATAR_DEFINITIONS,
  type AvatarId
} from "./avatars.js";
import {
  MOUNT_DEFINITIONS,
  type MountId
} from "./mounts.js";
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
  cityDetailPanel: HTMLElement;
  closeCityDetailButton: HTMLButtonElement;
  setCityDetailPanelOpen(snapshot: CityDetailSnapshot | null): void;
  customizationPanel: HTMLElement;
  closeCustomizationButton: HTMLButtonElement;
  /** 设置面板开关。null = 关闭。snapshot = 打开并刷新选中态。 */
  setCustomizationPanelOpen(
    snapshot: CustomizationPanelSnapshot | null
  ): void;
  /** 用户在面板里点选 mount 的回调。由 main.ts 注入。 */
  onSelectMount(handler: (id: MountId) => void): void;
  /** 用户在面板里点选 avatar 的回调。由 main.ts 注入。 */
  onSelectAvatar(handler: (id: AvatarId) => void): void;
}

export interface CustomizationPanelSnapshot {
  mountId: MountId;
  avatarId: AvatarId;
}

export interface CityDetailSnapshot {
  id: string;
  name: string;
  tier: "capital" | "prefecture" | "county";
  lat: number;
  lon: number;
  hint?: string;
  description?: string;
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
      <div class="eyebrow">千里江山图</div>
      <h1>秦岭 - 关中 - 四川盆地</h1>
      <div class="loading-line" id="loading-line"></div>
      <div class="title-environment" id="title-environment-line"></div>
    </div>
    <div class="compass-block" aria-label="游戏方位">
      <div class="compass-dial">
        <div class="compass-rosette" id="compass-rosette">
          <div class="compass-cardinal-anchor compass-north"><span class="compass-cardinal-label">北</span></div>
          <div class="compass-cardinal-anchor compass-east"><span class="compass-cardinal-label">东</span></div>
          <div class="compass-cardinal-anchor compass-south"><span class="compass-cardinal-label">南</span></div>
          <div class="compass-cardinal-anchor compass-west"><span class="compass-cardinal-label">西</span></div>
        </div>
        <span class="compass-needle" id="compass-needle"></span>
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
      <summary>地图</summary>
      <canvas id="overview-map" width="280" height="194"></canvas>
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
        <span>P 坐骑/造型</span>
        <span>[ ] 切坐骑</span>
        <span>- = 切造型</span>
        <span>点击画面启用声音</span>
      </div>
    </details>
    <div class="toast" id="pickup-toast"></div>
    <aside class="city-detail-panel" id="city-detail-panel" aria-hidden="true">
      <div class="city-detail-inner">
        <header class="city-detail-head">
          <div class="eyebrow" id="city-detail-tier"></div>
          <h2 id="city-detail-name"></h2>
        </header>
        <div class="city-detail-hint" id="city-detail-hint"></div>
        <div class="city-detail-description" id="city-detail-description"></div>
        <footer class="city-detail-foot">
          <button id="close-city-detail" type="button">返回游戏</button>
        </footer>
      </div>
    </aside>
    <aside class="customization-panel" id="customization-panel" aria-hidden="true">
      <div class="customization-inner">
        <header class="customization-head">
          <div class="eyebrow">坐骑 · 造型</div>
          <h2>选你的伙伴与行装</h2>
          <p class="customization-hint">键盘：[ ] 切坐骑 · - = 切造型 · P 关闭</p>
        </header>
        <div class="customization-body">
          <section class="customization-column">
            <div class="customization-col-title">坐骑</div>
            <div class="customization-list" id="customization-mount-list">
              ${MOUNT_DEFINITIONS.map(
                (mount) => `
                  <button
                    class="customization-card"
                    data-mount="${mount.id}"
                    type="button"
                  >
                    <strong>${mount.name}</strong>
                    <span>${mount.description}</span>
                  </button>
                `
              ).join("")}
            </div>
          </section>
          <section class="customization-column">
            <div class="customization-col-title">造型</div>
            <div class="customization-list" id="customization-avatar-list">
              ${AVATAR_DEFINITIONS.map(
                (avatar) => `
                  <button
                    class="customization-card"
                    data-avatar="${avatar.id}"
                    type="button"
                  >
                    <strong>${avatar.name}</strong>
                    <span>${avatar.description}</span>
                  </button>
                `
              ).join("")}
            </div>
          </section>
        </div>
        <footer class="customization-foot">
          <button id="close-customization" type="button">返回游戏</button>
        </footer>
      </div>
    </aside>
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
  const compassRosette = requireElement<HTMLElement>(hud, "#compass-rosette");
  const pickupToast = requireElement<HTMLElement>(hud, "#pickup-toast");
  const zoneLine = requireElement<HTMLElement>(hud, "#zone-line");
  const modeLine = requireElement<HTMLElement>(hud, "#mode-line");
  const environmentLine = requireElement<HTMLElement>(hud, "#environment-line");
  const titleEnvironmentLine = requireElement<HTMLElement>(hud, "#title-environment-line");
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

  const cityDetailPanel = requireElement<HTMLElement>(hud, "#city-detail-panel");
  const cityDetailTier = requireElement<HTMLElement>(hud, "#city-detail-tier");
  const cityDetailName = requireElement<HTMLElement>(hud, "#city-detail-name");
  const cityDetailHint = requireElement<HTMLElement>(hud, "#city-detail-hint");
  const cityDetailDescription = requireElement<HTMLElement>(
    hud,
    "#city-detail-description"
  );
  const closeCityDetailButton = requireElement<HTMLButtonElement>(
    hud,
    "#close-city-detail"
  );

  const customizationPanel = requireElement<HTMLElement>(
    hud,
    "#customization-panel"
  );
  const customizationMountList = requireElement<HTMLElement>(
    hud,
    "#customization-mount-list"
  );
  const customizationAvatarList = requireElement<HTMLElement>(
    hud,
    "#customization-avatar-list"
  );
  const closeCustomizationButton = requireElement<HTMLButtonElement>(
    hud,
    "#close-customization"
  );

  let mountSelectHandler: ((id: MountId) => void) | null = null;
  let avatarSelectHandler: ((id: AvatarId) => void) | null = null;

  // 卡片点击：dispatch 给外部注入的 handler。一次绑定，依赖 data-* 属性识别 id。
  customizationMountList.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      "[data-mount]"
    );
    if (!target || !mountSelectHandler) return;
    const id = target.dataset.mount as MountId | undefined;
    if (id) {
      mountSelectHandler(id);
    }
  });
  customizationAvatarList.addEventListener("click", (event) => {
    const target = (event.target as HTMLElement | null)?.closest<HTMLElement>(
      "[data-avatar]"
    );
    if (!target || !avatarSelectHandler) return;
    const id = target.dataset.avatar as AvatarId | undefined;
    if (id) {
      avatarSelectHandler(id);
    }
  });

  const setActiveCard = (
    container: HTMLElement,
    attribute: string,
    activeId: string
  ): void => {
    container.querySelectorAll<HTMLElement>(`[${attribute}]`).forEach((card) => {
      card.classList.toggle(
        "active",
        card.getAttribute(attribute) === activeId
      );
    });
  };

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
      // 新罗盘：箭头永远向上（指向当前视角的前方），罗盘玫瑰（北东南西
      // 标签）按相机朝向旋转。同时给 rosette 写一个 CSS 变量
      // --label-counter-rotation，让每个 cardinal label 内部反向旋转
      // 同样角度，保证文字始终是竖直的（不会变成倒立的"南"）。
      if (lastCompass?.northAngleRadians !== snapshot.northAngleRadians) {
        compassRosette.style.transform =
          `translate(-50%, -50%) rotate(${snapshot.northAngleRadians}rad)`;
        compassRosette.style.setProperty(
          "--label-counter-rotation",
          `${-snapshot.northAngleRadians}rad`
        );
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
        // 顶端 title-block 也回显时辰 + 季节 + 天气，免去用户展开"更多状态"。
        titleEnvironmentLine.textContent = snapshot.environment;
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
    },
    cityDetailPanel,
    closeCityDetailButton,
    setCityDetailPanelOpen(snapshot) {
      if (snapshot === null) {
        cityDetailPanel.classList.remove("open");
        cityDetailPanel.setAttribute("aria-hidden", "true");
        return;
      }
      const tierLabel =
        snapshot.tier === "capital"
          ? "京城"
          : snapshot.tier === "prefecture"
            ? "州府"
            : "县城";
      cityDetailTier.textContent =
        `${tierLabel}  ·  ${snapshot.lat.toFixed(2)}°N  ${snapshot.lon.toFixed(2)}°E`;
      cityDetailName.textContent = snapshot.name;
      if (snapshot.hint) {
        cityDetailHint.textContent = snapshot.hint;
        cityDetailHint.hidden = false;
      } else {
        cityDetailHint.textContent = "";
        cityDetailHint.hidden = true;
      }
      if (snapshot.description) {
        // 把 \n\n 拆成段落；段内 \n 转 <br>
        cityDetailDescription.innerHTML = snapshot.description
          .split(/\n\n+/)
          .map((para) => `<p>${para.replace(/\n/g, "<br>")}</p>`)
          .join("");
      } else {
        cityDetailDescription.innerHTML = "<p>更多详情待补。</p>";
      }
      cityDetailPanel.classList.add("open");
      cityDetailPanel.setAttribute("aria-hidden", "false");
    },
    customizationPanel,
    closeCustomizationButton,
    setCustomizationPanelOpen(snapshot) {
      if (snapshot === null) {
        customizationPanel.classList.remove("open");
        customizationPanel.setAttribute("aria-hidden", "true");
        return;
      }
      setActiveCard(customizationMountList, "data-mount", snapshot.mountId);
      setActiveCard(customizationAvatarList, "data-avatar", snapshot.avatarId);
      customizationPanel.classList.add("open");
      customizationPanel.setAttribute("aria-hidden", "false");
    },
    onSelectMount(handler) {
      mountSelectHandler = handler;
    },
    onSelectAvatar(handler) {
      avatarSelectHandler = handler;
    }
  };

  controller.setLoadingState(`正在载入母版：${initialLoadingLabel}`);
  controller.setActiveMode("terrain");
  controller.updateCompass({
    northAngleRadians: 0
  });
  controller.updateStatus({
    ...defaultStatusSnapshot,
    collection: `残简：0 / ${fragmentCount}`
  });

  return controller;
}
