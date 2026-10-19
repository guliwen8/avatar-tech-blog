import path from "node:path";
import { localVideoRoot, localVideoInfo } from "./local-video";
import { getDB } from "./db";
import { getAIConfig } from "./editorial-ai";
import { generateEditorial } from "./editorial-generator";
import { upsertPost, type Post } from "./repo";
import { rateLimit } from "./community";
import { runVideoJob } from "./video-jobs";
import { collectVideo } from "./video-source.mjs";
import { transcribeMiniMax } from "./video-asr.mjs";
let pending: Promise<void> | null = null;
export function runPendingImports() {
  if (pending) return pending;
  pending = (async () => {
    const db = getDB();
    while (
      await runVideoJob(db, {
        collect: async (input, signal) => {
          const config = getAIConfig(db);
          const local = input.url.startsWith("local-video:")
            ? localVideoInfo(db, input.url)
            : null;
          return collectVideo(input, {
            localMedia: local
              ? {
                  path: path.join(localVideoRoot(), local.id),
                  name: local.name,
                }
              : undefined,
            signal,
            allowTranscription: !!(
              config.enabled &&
              config.apiKey &&
              config.allowVideoTranscription
            ),
            transcribe: (bytes: Buffer, s: AbortSignal) =>
              transcribeMiniMax(config, bytes, s),
          });
        },
        generate: async (input, source, signal) => {
          if (!rateLimit(db, "editorial:generate", 10, 3600000))
            throw Error("AI 生成已达到每小时 10 次上限，请稍后手动重试");
          const url = source.url.startsWith("local-video:")
            ? null
            : new URL(source.url);
          if (url?.pathname.toLowerCase().endsWith(".mp4")) url.search = "";
          return generateEditorial(
            getAIConfig(db),
            {
              source: source.text,
              sources: `来源视频：${source.title}\n${url?.href || "本地上传视频（后台私有素材）"}\n仅基于字幕/语音整理，未核验画面。`,
              template: input.template,
              style: input.style,
            },
            signal,
          );
        },
        persist: (post) => {
          upsertPost(post as Post);
          return post.slug;
        },
      })
    ) {}
  })().finally(() => {
    pending = null;
  });
  return pending;
}
