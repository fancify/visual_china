// 全国 0.9 km grid (26.87M cells × 4 channels) 大于 V8 单字符串上限。
// 把大 channels 拆成 binary sidecar，读取方用此 helper 重组成完整 DemAsset。

import fs from "node:fs/promises";
import path from "node:path";

/**
 * 读取拆分式 DEM asset：meta JSON + 4 个 .bin channel。
 * 兼容旧版（含 heights/riverMask/passMask/settlementMask 直接在 JSON 里）。
 *
 * @param {string} jsonPath  绝对路径，指向 qinling-slice-dem.json (meta) 或老
 *                           的全 inline JSON。
 * @returns {Promise<object>} 完整 asset 对象，channels 是 Number[]。
 */
export async function loadDemAssetWithChannels(jsonPath) {
  const meta = JSON.parse(await fs.readFile(jsonPath, "utf8"));

  // 老格式：channels 已经在 JSON 里。直接返回。
  if (Array.isArray(meta.heights)) {
    return meta;
  }

  if (!meta.binaryChannels) {
    throw new Error(
      `DEM asset ${jsonPath} 既无 inline channels 也无 binaryChannels meta`
    );
  }

  const baseDir = path.dirname(jsonPath);
  async function readChannel(name) {
    const filePath = path.join(baseDir, meta.binaryChannels[name]);
    const buf = await fs.readFile(filePath);
    const length = buf.length / 4;
    if (typeof meta.cells === "number" && length !== meta.cells) {
      throw new Error(
        `${name} 长度 ${length} 不匹配 meta.cells ${meta.cells}`
      );
    }
    const out = new Array(length);
    for (let i = 0; i < length; i += 1) {
      out[i] = buf.readFloatLE(i * 4);
    }
    return out;
  }

  const [heights, riverMask, passMask, settlementMask] = await Promise.all([
    readChannel("heights"),
    readChannel("riverMask"),
    readChannel("passMask"),
    readChannel("settlementMask")
  ]);

  // 删 binaryChannels meta，避免下游误以为还要再读一次
  // eslint-disable-next-line no-unused-vars
  const { binaryChannels, cells, ...cleanMeta } = meta;
  return {
    ...cleanMeta,
    heights,
    riverMask,
    passMask,
    settlementMask
  };
}
