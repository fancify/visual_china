import type { AudioRuntime } from "./audioContext";

export interface SfxTrack {
  id: string;
  category: "ambient" | "footsteps" | "cultural" | "ui" | "mount";
  kind: "loop" | "loop-or-cycle" | "one-shot";
  name: string;
  source_url: string;
}

interface SfxManifest {
  tracks?: SfxTrack[];
}

function trackPath(track: SfxTrack): string {
  return `/sfx/${track.category}/${track.id}.opus`;
}

export async function loadAllBuffers(
  runtime: AudioRuntime,
  manifestUrl = "/sfx/manifest.json"
): Promise<{ loaded: number; failed: number }> {
  let manifest: SfxManifest;

  try {
    const response = await fetch(manifestUrl);
    if (!response.ok) {
      console.warn(`[audio] manifest missing: ${manifestUrl} (${response.status})`);
      return { loaded: 0, failed: 0 };
    }
    manifest = await response.json() as SfxManifest;
  } catch (error: unknown) {
    console.warn(`[audio] manifest fetch failed: ${manifestUrl}`, error);
    return { loaded: 0, failed: 0 };
  }

  const tracks = Array.isArray(manifest.tracks) ? manifest.tracks : [];
  let loaded = 0;
  let failed = 0;

  await Promise.all(
    tracks.map(async (track) => {
      const path = trackPath(track);
      try {
        const response = await fetch(path);
        if (!response.ok) {
          failed += 1;
          console.warn(`[audio] track missing: ${path} (${response.status})`);
          return;
        }
        const arrayBuffer = await response.arrayBuffer();
        const buffer = await runtime.context.decodeAudioData(arrayBuffer);
        runtime.buffers.set(track.id, buffer);
        loaded += 1;
      } catch (error: unknown) {
        failed += 1;
        console.warn(`[audio] failed to load track: ${path}`, error);
      }
    })
  );

  return { loaded, failed };
}
