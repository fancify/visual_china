import {
  loadDemAsset,
  type ExperienceProfile,
  type LoadedDemAsset
} from "./demSampler";
import {
  loadRegionChunkManifest,
  type RegionChunkManifest
} from "./regionChunks";
import {
  loadRegionContent,
  type LoadedRegionContent
} from "./regionContent";

export interface RegionBundleWarning {
  scope: "chunk-manifest" | "poi-manifest";
  message: string;
  cause: unknown;
}

export interface LoadedRegionBundle {
  terrain: LoadedDemAsset;
  chunkManifest: RegionChunkManifest | null;
  chunkManifestUrl: string | null;
  content: LoadedRegionContent | null;
  /**
   * 区域的 experience profile（速度 / 镜头 / 内容密度 / 事件密度乘子）。
   * 来自 manifest.experienceProfile，运行时按这一份配置缩放体验节奏。
   * 如果 manifest 没声明，就是 undefined，调用方按默认（=1）处理。
   */
  experienceProfile?: ExperienceProfile;
  warnings: RegionBundleWarning[];
}

function resolveRelativeUrl(baseUrl: string, relativePath: string): string {
  return new URL(relativePath, new URL(baseUrl, window.location.href)).toString();
}

export async function loadRegionBundle(
  requestUrl: string
): Promise<LoadedRegionBundle> {
  const terrain = await loadDemAsset(requestUrl);
  const warnings: RegionBundleWarning[] = [];
  let chunkManifest: RegionChunkManifest | null = null;
  let chunkManifestUrl: string | null = null;
  let content: LoadedRegionContent | null = null;

  if (terrain.manifest?.chunking?.enabled) {
    try {
      chunkManifestUrl = resolveRelativeUrl(
        terrain.requestUrl,
        terrain.manifest.chunking.chunkManifest
      );
      chunkManifest = await loadRegionChunkManifest(chunkManifestUrl);
    } catch (error) {
      chunkManifest = null;
      chunkManifestUrl = null;
      warnings.push({
        scope: "chunk-manifest",
        message:
          "Failed to load region chunk manifest, falling back to full-region visibility.",
        cause: error
      });
    }
  }

  if (terrain.manifest?.poiManifest) {
    try {
      const poiManifestUrl = resolveRelativeUrl(
        terrain.requestUrl,
        terrain.manifest.poiManifest
      );
      content = await loadRegionContent(poiManifestUrl);
    } catch (error) {
      warnings.push({
        scope: "poi-manifest",
        message:
          "Failed to load region POI content, falling back to bundled defaults.",
        cause: error
      });
    }
  }

  return {
    terrain,
    chunkManifest,
    chunkManifestUrl,
    content,
    experienceProfile: terrain.manifest?.experienceProfile,
    warnings
  };
}
