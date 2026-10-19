import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { sourceUrl, publicRequest } from "./video-http.mjs";
export class NeedsTranscript extends Error {
  constructor(message) {
    super(message);
    this.name = "NeedsTranscript";
  }
}
export function classifyVideo(raw) {
  const u = sourceUrl(raw);
  if (raw.length > 4096) throw Error("视频链接过长");
  const host = u.hostname.toLowerCase();
  if (
    ["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"].includes(
      host,
    )
  ) {
    const id =
      host === "youtu.be"
        ? u.pathname.slice(1).split("/")[0]
        : u.pathname === "/watch"
          ? u.searchParams.get("v")
          : u.pathname.match(/^\/(?:shorts|live)\/([^/]+)/)?.[1];
    if (!id || !/^[-\w]{11}$/.test(id))
      throw Error("请提供单个 YouTube 视频链接");
    return { kind: "youtube", url: "https://www.youtube.com/watch?v=" + id };
  }
  if (["bilibili.com", "www.bilibili.com", "m.bilibili.com"].includes(host)) {
    const id = u.pathname.match(
      /^\/video\/(BV[a-zA-Z0-9]{10}|av\d+)(?:\/|$)/,
    )?.[1];
    if (!id) throw Error("请提供哔哩哔哩 /video/ 链接");
    return {
      kind: "bilibili",
      url:
        "https://www.bilibili.com/video/" +
        id +
        (u.searchParams.has("p")
          ? "?p=" + Math.max(1, Number(u.searchParams.get("p")) || 1)
          : ""),
    };
  }
  if (host === "b23.tv" && /^\/[A-Za-z0-9]+\/?$/.test(u.pathname))
    return { kind: "bilibili", url: u.href };
  if (/\.mp4$/i.test(u.pathname)) return { kind: "mp4", url: u.href };
  throw Error("支持 YouTube、哔哩哔哩或 HTTPS MP4 直链");
}
export function transcriptText(raw) {
  let text = raw.trim();
  if (!text) throw new NeedsTranscript("没有可用字幕，请补充字幕内容");
  if (/<!doctype\s+html|<html\b|<body\b/i.test(text))
    throw new NeedsTranscript("来源返回了网页，未获得字幕");
  let j;
  try {
    j = JSON.parse(text);
  } catch {}
  if (j !== undefined) {
    if (Array.isArray(j?.events))
      text = j.events
        .map((e) => (e.segs || []).map((s) => s.utf8 || "").join(""))
        .join("\n");
    else if (Array.isArray(j?.body))
      text = j.body.map((e) => e.content || "").join("\n");
    else throw new NeedsTranscript("来源返回的内容不是支持的字幕格式");
  }
  text = text
    .replace(/\r/g, "")
    .split("\n")
    .filter(
      (line, i, lines) =>
        !/^\s*(WEBVTT|NOTE\b.*|Kind:.*|Language:.*)\s*$/.test(line) &&
        !/^\s*(?:\d{1,2}:)?\d{2}:\d{2}[.,]\d{3}\s+-->/.test(line) &&
        !(/^\s*\d+\s*$/.test(line) && lines[i + 1]?.includes("-->")),
    )
    .map((line) =>
      line
        .replace(/<\/?(?:c|v|lang|b|i|u|ruby|rt)(?:[ .][^>]*)?>/gi, "")
        .replace(/<\d{2}:\d{2}[^>]*>/g, "")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .trim(),
    )
    .filter(Boolean)
    .filter((line, i, lines) => i === 0 || line !== lines[i - 1])
    .join("\n");
  if (text.length > 40000)
    throw new NeedsTranscript("字幕超过 40000 字符，请选择一段后补充字幕");
  if (text.length < 10)
    throw new NeedsTranscript("没有获得足够的语音内容，请补充字幕");
  return text;
}
export function runTool(
  command,
  args,
  { signal, timeoutMs = 180000, maxBytes = 8 * 1024 * 1024 } = {},
) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(Error("任务已取消"));
      return;
    }
    let output = "",
      bytes = 0;
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
      env: { ...process.env },
    });
    const stop = () => {
      try {
        process.kill(-child.pid, "SIGKILL");
      } catch {
        child.kill("SIGKILL");
      }
    };
    const timer = setTimeout(() => {
      stop();
      reject(new NeedsTranscript("视频工具运行超时，请补充字幕或稍后重试"));
    }, timeoutMs);
    const cancel = () => {
      stop();
      reject(Error("任务已取消"));
    };
    signal?.addEventListener("abort", cancel, { once: true });
    child.stdout.on("data", (buf) => {
      bytes += buf.length;
      if (bytes > maxBytes) {
        stop();
        reject(new NeedsTranscript("来源信息过大，请补充字幕"));
        return;
      }
      output += buf.toString();
    });
    child.stderr.on("data", () => {});
    child.on("error", () =>
      reject(new NeedsTranscript("视频采集工具不可用，请补充字幕或检查部署")),
    );
    child.on("close", (code) => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
      if (code === 0) resolve(output);
      else
        reject(
          new NeedsTranscript(
            "平台内容无法读取，可能无字幕、需要登录或网络不可达；请补充字幕，不会根据标题猜测内容",
          ),
        );
    });
  });
}
function metadataArgs(url) {
  return [
    "--ignore-config",
    "--no-playlist",
    "--no-warnings",
    "--socket-timeout",
    "15",
    "--retries",
    "1",
    "--extractor-retries",
    "1",
    "--js-runtimes",
    "node:" + process.execPath,
    "--skip-download",
    "--dump-single-json",
    url,
  ];
}
/** @param {any} input @param {any} [options] */
export async function collectVideo(input, options = {}) {
  const {
    signal,
    localMedia,
    transcribe,
    allowTranscription = false,
    fetcher = publicRequest,
    tool = runTool,
  } = options;
  const info = localMedia
    ? { kind: "local", url: input.url }
    : classifyVideo(input.url);
  if (input.transcript?.trim())
    return {
      text: transcriptText(input.transcript),
      method: "provided",
      title: localMedia?.name || "用户补充的视频字幕",
      url: info.url,
    };
  let url = info.url;
  if (info.kind !== "local" && new URL(url).hostname === "b23.tv") {
    const r = await fetcher(url, { signal, maxBytes: 1024 * 1024 });
    const resolved = classifyVideo(r.finalUrl);
    if (
      resolved.kind !== "bilibili" ||
      new URL(resolved.url).hostname === "b23.tv"
    )
      throw new NeedsTranscript("短链接无法解析，请使用完整哔哩哔哩视频链接");
    url = resolved.url;
  }
  let metadata, captionFailure = "",
    title = localMedia?.name || "视频资料";
  if (info.kind !== "mp4" && info.kind !== "local") {
    try {
      metadata = JSON.parse(
        await tool(process.env.YTDLP_PATH || "yt-dlp", metadataArgs(url), {
          signal,
        }),
      );
      title = String(metadata.title || title).slice(0, 200);
      const tracks = { ...metadata.automatic_captions, ...metadata.subtitles };
      for (const lang of Object.keys(tracks)
        .sort(
          (a, b) =>
            (/^zh/.test(a) ? 0 : /^en/.test(a) ? 1 : 2) -
            (/^zh/.test(b) ? 0 : /^en/.test(b) ? 1 : 2),
        )
        .slice(0, 3)) {
        const track = tracks[lang]?.find((t) =>
          ["json3", "vtt", "srt", "json"].includes(t.ext),
        );
        if (!track?.url) continue;
        try {
          const r = await fetcher(
            track.url.startsWith("//") ? "https:" + track.url : track.url,
            { signal, maxBytes: 4 * 1024 * 1024 },
          );
          return {
            text: transcriptText(r.body.toString("utf8")),
            method: "subtitles",
            title,
            url,
          };
        } catch (e) {
          if (signal?.aborted) throw e;
          captionFailure = e.message.startsWith("来源") ? e.message : "字幕内容无法读取";
        }
      }
    } catch (e) {
      if (e instanceof NeedsTranscript || signal?.aborted) throw e;
      throw new NeedsTranscript("未能读取视频字幕，请补充字幕或检查来源链接");
    }
  }
  if (Number(metadata?.duration) > 600)
    throw new NeedsTranscript(
      `自动获取字幕未成功${captionFailure ? "："+captionFailure : "（平台未返回可用字幕）"}；超过 10 分钟的视频暂不下载音频转写，可补充片段字幕`,
    );
  if (!allowTranscription || !transcribe)
    throw new NeedsTranscript(
      info.kind === "mp4" || info.kind === "local"
        ? "MP4 需要启用视频语音转写，或手动补充字幕"
        : "未获取到公开字幕；可补充字幕，或启用语音转写后重试",
    );
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "avatar-video-"));
  try {
    let media = path.join(root, "input.mp4");
    if (info.kind === "local") await fs.copyFile(localMedia.path, media);
    else if (info.kind === "mp4")
      await fetcher(url, { signal, maxBytes: 80 * 1024 * 1024, saveTo: media });
    else {
      await tool(
        process.env.YTDLP_PATH || "yt-dlp",
        [
          "--ignore-config",
          "--no-playlist",
          "--no-warnings",
          "--socket-timeout",
          "15",
          "--retries",
          "1",
          "--max-filesize",
          "80M",
          "--js-runtimes",
          "node:" + process.execPath,
          "-f",
          "bestaudio[ext=m4a]/bestaudio",
          "-o",
          path.join(root, "input.%(ext)s"),
          url,
        ],
        { signal, timeoutMs: 240000 },
      );
      const names = await fs.readdir(root);
      const found = names.find((n) => /^input\.[a-z0-9]+$/i.test(n));
      if (!found)
        throw new NeedsTranscript("未取得允许大小内的音频，请补充字幕");
      media = path.join(root, found);
    }
    const probe = JSON.parse(
      await tool(
        process.env.FFPROBE_PATH || "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "json",
          "-protocol_whitelist",
          "file,pipe",
          media,
        ],
        { signal, timeoutMs: 20000 },
      ),
    );
    if (
      !Number.isFinite(Number(probe.format?.duration)) ||
      Number(probe.format.duration) > 600
    )
      throw new NeedsTranscript(
        "视频超过 10 分钟或无法读取时长，请补充片段字幕",
      );
    const audio = path.join(root, "audio.mp3");
    await tool(
      process.env.FFMPEG_PATH || "ffmpeg",
      [
        "-nostdin",
        "-v",
        "error",
        "-protocol_whitelist",
        "file,pipe",
        "-i",
        media,
        "-vn",
        "-ac",
        "1",
        "-ar",
        "16000",
        "-b:a",
        "32k",
        audio,
      ],
      { signal, timeoutMs: 90000 },
    );
    const bytes = await fs.readFile(audio);
    if (bytes.length > 8 * 1024 * 1024)
      throw new NeedsTranscript("音频超过转写限制，请补充片段字幕");
    return {
      text: transcriptText(await transcribe(bytes, signal)),
      method: "asr",
      title,
      url,
    };
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
}
