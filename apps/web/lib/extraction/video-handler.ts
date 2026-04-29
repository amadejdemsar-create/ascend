/**
 * Video extraction handler.
 *
 * Extracts the audio track from a video file using ffmpeg, then delegates
 * to the audio handler for transcription via OpenAI Whisper.
 *
 * ffmpeg binary resolution priority:
 *   1. process.env.FFMPEG_PATH (explicit override)
 *   2. ffmpeg-static npm package (local dev on macOS)
 *   3. System ffmpeg via `which ffmpeg` (production Alpine: `apk add ffmpeg`)
 *
 * Temp files are written to os.tmpdir() and always cleaned up in a `finally`
 * block, even on error. Frame thumbnail extraction is deferred to a future
 * phase per the PRD.
 */

import { spawn, execSync } from "node:child_process";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";
import type { ExtractionResult, ExtractionHandlerOpts } from "./types";
import { extractAudio } from "./audio-handler";

// ── ffmpeg binary resolution ────────────────────────────────────

let cachedFfmpegPath: string | null = null;

async function resolveFfmpegPath(): Promise<string> {
  if (cachedFfmpegPath) return cachedFfmpegPath;

  // 1. Explicit env var override
  if (process.env.FFMPEG_PATH) {
    cachedFfmpegPath = process.env.FFMPEG_PATH;
    return cachedFfmpegPath;
  }

  // 2. ffmpeg-static (local dev, ships a platform-specific binary)
  try {
    // Dynamic import because ffmpeg-static may not be installed in production
    // (Alpine uses system ffmpeg). The default export is the binary path.
    const mod = await import("ffmpeg-static");
    const path = (mod.default ?? mod) as string;
    if (path && typeof path === "string") {
      cachedFfmpegPath = path;
      return cachedFfmpegPath;
    }
  } catch {
    // ffmpeg-static not available; fall through to system lookup
  }

  // 3. System ffmpeg (production: `apk add ffmpeg` in Dockerfile)
  try {
    const systemPath = execSync("which ffmpeg", { encoding: "utf-8" }).trim();
    if (systemPath) {
      cachedFfmpegPath = systemPath;
      return cachedFfmpegPath;
    }
  } catch {
    // which not found or ffmpeg not in PATH
  }

  // 4. Hardcoded fallback for Alpine
  cachedFfmpegPath = "/usr/bin/ffmpeg";
  return cachedFfmpegPath;
}

// ── Handler ─────────────────────────────────────────────────────

export async function extractVideo(
  buffer: Buffer,
  mimeType: string,
  opts?: ExtractionHandlerOpts,
): Promise<ExtractionResult> {
  const userId = opts?.userId;
  if (!userId) {
    throw new Error("Video extraction requires userId for cost tracking");
  }

  const sessionId = randomUUID();
  const inputPath = join(tmpdir(), `ascend-video-${sessionId}.tmp`);
  const outputPath = join(tmpdir(), `ascend-audio-${sessionId}.mp3`);

  try {
    // Write video buffer to a temp file (ffmpeg needs a file path)
    await writeFile(inputPath, buffer);

    // Extract audio track to MP3 using ffmpeg
    const ffmpegPath = await resolveFfmpegPath();
    await runFfmpeg(ffmpegPath, inputPath, outputPath, opts?.signal);

    // Read the extracted audio file
    const audioBuffer = await readFile(outputPath);

    // Delegate to audio handler for transcription
    const result = await extractAudio(
      Buffer.from(audioBuffer),
      "audio/mpeg",
      opts,
    );

    return {
      text: result.text,
      durationSec: result.durationSec,
      // Frame thumbnail extraction deferred per PRD
    };
  } finally {
    // Always clean up temp files
    await safeUnlink(inputPath);
    await safeUnlink(outputPath);
  }
}

// ── ffmpeg subprocess ───────────────────────────────────────────

function runFfmpeg(
  ffmpegPath: string,
  inputPath: string,
  outputPath: string,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error("Aborted before ffmpeg started"));
      return;
    }

    const proc = spawn(ffmpegPath, [
      "-i",
      inputPath,
      "-vn", // no video
      "-acodec",
      "libmp3lame",
      "-ar",
      "16000", // 16 kHz sample rate (sufficient for speech)
      "-ac",
      "1", // mono
      "-ab",
      "64k", // 64 kbps (keeps output small for Whisper)
      "-y", // overwrite output file
      outputPath,
    ]);

    let stderr = "";
    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    proc.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `ffmpeg exited with code ${code}. stderr: ${stderr.slice(-500)}`,
          ),
        );
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`ffmpeg spawn error: ${err.message}`));
    });

    // Handle abort signal by killing the ffmpeg process
    if (signal) {
      const onAbort = () => {
        proc.kill("SIGTERM");
        reject(new Error("ffmpeg aborted by signal"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
      proc.on("close", () => {
        signal.removeEventListener("abort", onAbort);
      });
    }
  });
}

// ── Helpers ─────────────────────────────────────────────────────

async function safeUnlink(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch {
    // File may not have been created; ignore cleanup errors
  }
}
