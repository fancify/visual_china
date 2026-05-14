import { lstat, readdir, unlink } from "node:fs/promises";

export async function removeStaleChunkOutput(filePath) {
  try {
    const stats = await lstat(filePath);
    if (!stats.isFile()) return false;
    await unlink(filePath);
    return true;
  } catch (error) {
    if (error && error.code === "ENOENT") return false;
    throw error;
  }
}

export async function removeStaleTierChunks(tierDir, liveChunkKeys) {
  let files;
  try {
    files = await readdir(tierDir);
  } catch (error) {
    if (error && error.code === "ENOENT") return [];
    throw error;
  }

  const removed = [];
  for (const fileName of files) {
    if (!fileName.endsWith(".bin")) continue;
    const key = fileName.slice(0, -".bin".length);
    if (liveChunkKeys.has(key)) continue;
    const filePath = `${tierDir}/${fileName}`;
    if (await removeStaleChunkOutput(filePath)) {
      removed.push(fileName);
    }
  }
  removed.sort();
  return removed;
}
