#!/usr/bin/env node
// 下载 public/sfx/manifest.json 中的所有音效，转成 Opus 96kbps mono 落到
// public/sfx/<category>/<id>.opus。已存在的文件默认 skip（除非 --force）。
// brew 装的 ffmpeg 8.x 默认不带 libvorbis，但带 libopus；Opus 在 Web Audio
// 同样原生支持，96kbps 时音质和体积都比 Vorbis 更优。
//
// 依赖：curl + ffmpeg。
// 用法：
//   node scripts/download-sfx.mjs           # 下载缺失项
//   node scripts/download-sfx.mjs --force   # 强制重新下载并转码
//   node scripts/download-sfx.mjs --only ambient_soft_wind  # 单条
//
// 注意：ogg 输出文件不入 git（见 .gitignore），manifest 入 git 作为 source of truth。

import { execSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";

const ROOT = process.cwd();
const MANIFEST_PATH = join(ROOT, "public/sfx/manifest.json");
const SFX_DIR = join(ROOT, "public/sfx");
const TMP_DIR = join(ROOT, "tmp/sfx-raw");

const args = process.argv.slice(2);
const FORCE = args.includes("--force");
const onlyIdx = args.indexOf("--only");
const ONLY = onlyIdx >= 0 ? args[onlyIdx + 1] : null;

mkdirSync(TMP_DIR, { recursive: true });

const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf-8"));
const tracks = ONLY ? manifest.tracks.filter((t) => t.id === ONLY) : manifest.tracks;

if (ONLY && tracks.length === 0) {
  console.error(`[download-sfx] no track with id "${ONLY}"`);
  process.exit(1);
}

let ok = 0;
let skipped = 0;
let failed = 0;

for (const track of tracks) {
  const targetDir = join(SFX_DIR, track.category);
  const targetFile = join(targetDir, `${track.id}.opus`);
  mkdirSync(targetDir, { recursive: true });

  if (existsSync(targetFile) && !FORCE) {
    skipped++;
    continue;
  }

  const ext = track.source_url.match(/\.(mp3|wav|ogg|flac)(?:\?|$)/i)?.[1] ?? "mp3";
  const tmpFile = join(TMP_DIR, `${track.id}.${ext}`);

  try {
    process.stdout.write(`[download-sfx] ${track.id} ... `);
    // 下载
    execSync(`curl -fsSL --max-time 60 -o "${tmpFile}" "${track.source_url}"`, {
      stdio: ["ignore", "ignore", "pipe"]
    });

    // ffmpeg 转 Opus：mono、48kHz（Opus native）、96 kbps CBR，覆盖
    const ffmpeg = spawnSync(
      "ffmpeg",
      [
        "-y",
        "-loglevel",
        "error",
        "-i",
        tmpFile,
        "-ac",
        "1",
        "-ar",
        "48000",
        "-c:a",
        "libopus",
        "-b:a",
        "96k",
        targetFile
      ],
      { stdio: ["ignore", "ignore", "pipe"] }
    );
    if (ffmpeg.status !== 0) {
      throw new Error(`ffmpeg exit ${ffmpeg.status}: ${ffmpeg.stderr?.toString() ?? ""}`);
    }

    const stats = statSync(targetFile);
    track.size_bytes = stats.size;
    process.stdout.write(`OK (${(stats.size / 1024).toFixed(1)} KB)\n`);
    ok++;
  } catch (err) {
    process.stdout.write(`FAIL\n`);
    console.error(`  ${err.message ?? err}`);
    track.last_error = String(err.message ?? err).slice(0, 240);
    failed++;
  }
}

// 写回 manifest（带 size_bytes / last_error）
writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");

console.log(
  `[download-sfx] done. ok=${ok}  skipped=${skipped}  failed=${failed}  total=${tracks.length}`
);
process.exit(failed > 0 ? 1 : 0);
