import fs from "node:fs/promises";

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) {
    return "unknown";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  const units = ["KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = -1;

  do {
    value /= 1024;
    unitIndex += 1;
  } while (value >= 1024 && unitIndex < units.length - 1);

  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

async function fetchArchive(url, startByte = 0) {
  const headers = startByte > 0 ? { Range: `bytes=${startByte}-` } : undefined;
  return fetch(url, { headers });
}

export async function downloadArchive({
  archiveName,
  url,
  destination,
  force = false,
  expectedBytes
}) {
  const partialDestination = `${destination}.part`;

  if (!force) {
    try {
      const stat = await fs.stat(destination);

      if (stat.size > 0) {
        if (
          Number.isFinite(expectedBytes) &&
          expectedBytes > 0 &&
          stat.size !== expectedBytes
        ) {
          throw new Error(
            [
              `${archiveName} exists but has unexpected size.`,
              `expected=${formatBytes(expectedBytes)}`,
              `actual=${formatBytes(stat.size)}`,
              "Move it aside or rerun with --force if you want to restart the download."
            ].join(" ")
          );
        }

        console.log(`Skip existing ${archiveName}`);
        return { skipped: true, destination };
      }
    } catch {
      // Continue with download.
    }
  }

  let resumeFrom = 0;

  if (force) {
    try {
      await fs.unlink(partialDestination);
    } catch {
      // Ignore stale partials.
    }
  } else {
    try {
      const partialStat = await fs.stat(partialDestination);
      resumeFrom = partialStat.size;
    } catch {
      // No existing partial.
    }
  }

  let response = await fetchArchive(url, resumeFrom);

  if (!response.ok || !response.body) {
    throw new Error(`Failed to download ${url} (${response.status})`);
  }

  if (resumeFrom > 0 && response.status !== 206) {
    console.warn(
      `Server ignored resume request for ${archiveName}; restarting from byte 0.`
    );
    await fs.unlink(partialDestination).catch(() => {});
    resumeFrom = 0;
    response = await fetchArchive(url, 0);

    if (!response.ok || !response.body) {
      throw new Error(`Failed to restart download ${url} (${response.status})`);
    }
  }

  const mode = resumeFrom > 0 ? "a" : "w";
  const file = await fs.open(partialDestination, mode);
  const contentLengthHeader = response.headers.get("content-length");
  const contentLength = contentLengthHeader ? Number(contentLengthHeader) : NaN;
  const totalBytes =
    Number.isFinite(contentLength) && contentLength >= 0
      ? resumeFrom + contentLength
      : NaN;

  console.log(
    resumeFrom > 0
      ? `Resuming ${archiveName} from ${formatBytes(resumeFrom)} of ${formatBytes(totalBytes)}`
      : `Downloading ${archiveName}${Number.isFinite(totalBytes) ? ` (${formatBytes(totalBytes)})` : ""}`
  );

  try {
    for await (const chunk of response.body) {
      await file.write(chunk);
    }
  } finally {
    await file.close();
  }

  await fs.rename(partialDestination, destination);

  if (Number.isFinite(expectedBytes) && expectedBytes > 0) {
    const finalStat = await fs.stat(destination);

    if (finalStat.size !== expectedBytes) {
      throw new Error(
        [
          `${archiveName} finished with unexpected size.`,
          `expected=${formatBytes(expectedBytes)}`,
          `actual=${formatBytes(finalStat.size)}`
        ].join(" ")
      );
    }
  }

  console.log(`Downloaded ${destination}`);
  return { skipped: false, destination };
}
