import type Database from "better-sqlite3";
import crypto from "node:crypto";
import { classifyVideo } from "./video-source.mjs";
import { slugify } from "../lib/slug";

/** 用拼音生成可读 slug；重名加 -2、-3，避免 upsert 覆盖已有文章。 */
function uniqueSlug(db: Database.Database, base: string): string {
  const root = base || "video-" + Date.now();
  let slug = root;
  let n = 2;
  while (db.prepare("SELECT 1 FROM posts WHERE slug=?").get(slug))
    slug = `${root}-${n++}`;
  return slug;
}
export interface VideoInput {
  url: string;
  template: string;
  style: string;
  transcript?: string;
}
export function migrateVideoJobs(db: Database.Database) {
  db.exec(
    `CREATE TABLE IF NOT EXISTS video_import_jobs(id TEXT PRIMARY KEY,url TEXT NOT NULL,input TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'queued',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,lease_until INTEGER NOT NULL DEFAULT 0,claim TEXT NOT NULL DEFAULT '',error TEXT NOT NULL DEFAULT '',post_slug TEXT NOT NULL DEFAULT '',attempts INTEGER NOT NULL DEFAULT 0);CREATE INDEX IF NOT EXISTS video_jobs_status ON video_import_jobs(status,created_at)`,
  );
}
export function listVideoJobs(db: Database.Database) {
  return db
    .prepare(
      "SELECT id,url,status,created_at,updated_at,error,post_slug,attempts FROM video_import_jobs ORDER BY created_at DESC LIMIT 50",
    )
    .all() as {
    id: string;
    url: string;
    status: string;
    created_at: number;
    updated_at: number;
    error: string;
    post_slug: string;
    attempts: number;
  }[];
}
export function recoverVideoJobs(db: Database.Database, now = Date.now()) {
  db.prepare(
    "UPDATE video_import_jobs SET status='needs_input',error='任务运行中断，请检查后手动重试，避免重复调用付费服务',updated_at=? WHERE status='running' AND lease_until<?",
  ).run(now, now);
}
export function enqueueVideoJob(db: Database.Database, input: VideoInput) {
  const info = /^local-video:[a-f0-9-]{36}$/.test(input.url)
    ? { url: input.url }
    : classifyVideo(input.url);
  if (
    !["tutorial", "tool", "resource", "note"].includes(input.template) ||
    !["auto", "concise", "complete"].includes(input.style)
  )
    throw Error("模板或整理方式无效");
  if (
    typeof (input.transcript ?? "") !== "string" ||
    (input.transcript || "").length > 40000
  )
    throw Error("补充字幕最多 40000 字符");
  const value = {
    url: info.url,
    template: input.template,
    style: input.style,
    transcript: input.transcript || "",
  };
  return db
    .transaction(() => {
      const old = db
        .prepare(
          "SELECT id FROM video_import_jobs WHERE input=? AND status IN ('queued','running','succeeded') ORDER BY created_at DESC LIMIT 1",
        )
        .get(JSON.stringify(value)) as { id: string } | undefined;
      if (old) return old;
      const count = db
        .prepare(
          "SELECT COUNT(*) n FROM video_import_jobs WHERE status IN ('queued','running')",
        )
        .get() as { n: number };
      if (count.n >= 10) throw Error("等待任务最多 10 个，请先处理已有任务");
      const id = crypto.randomUUID(),
        now = Date.now();
      db.prepare(
        "INSERT INTO video_import_jobs(id,url,input,created_at,updated_at) VALUES(?,?,?,?,?)",
      ).run(id, info.url, JSON.stringify(value), now, now);
      return { id };
    })
    .immediate();
}
export function cancelVideoJob(db: Database.Database, id: string) {
  const r = db
    .prepare(
      "UPDATE video_import_jobs SET status='cancelled',updated_at=?,error='已取消；已发出的 API 调用可能仍计费' WHERE id=? AND status IN ('queued','running','needs_input','failed')",
    )
    .run(Date.now(), id);
  if (!r.changes) throw Error("任务不存在或已经完成");
}
export function retryVideoJob(
  db: Database.Database,
  id: string,
  transcript?: string,
) {
  db.transaction(() => {
    const r = db
      .prepare(
        "SELECT input,attempts FROM video_import_jobs WHERE id=? AND status IN ('needs_input','failed','cancelled')",
      )
      .get(id) as { input: string; attempts: number } | undefined;
    if (!r) throw Error("此任务不能重试");
    if (r.attempts >= 3)
      throw Error("此任务已尝试 3 次，请检查来源及配置后重新创建");
    const input = JSON.parse(r.input);
    if (transcript !== undefined) {
      if (typeof transcript !== "string" || transcript.length > 40000)
        throw Error("补充字幕最多 40000 字符");
      input.transcript = transcript;
    }
    db.prepare(
      "UPDATE video_import_jobs SET input=?,status='queued',error='',claim='',lease_until=0,updated_at=? WHERE id=?",
    ).run(JSON.stringify(input), Date.now(), id);
  }).immediate();
}
interface ImportResult {
  text: string;
  method: string;
  title: string;
  url: string;
}
interface Candidate {
  title: string;
  description: string;
  content: string;
  warnings?: string[];
}
export async function runVideoJob(
  db: Database.Database,
  deps: {
    collect: (input: VideoInput, signal: AbortSignal) => Promise<ImportResult>;
    generate: (
      input: VideoInput,
      source: ImportResult,
      signal: AbortSignal,
    ) => Promise<Candidate>;
    persist: (post: any) => string;
  },
) {
  const now = Date.now();
  recoverVideoJobs(db, now);
  const job = db
    .transaction(() => {
      if (
        db
          .prepare("SELECT id FROM video_import_jobs WHERE status='running'")
          .get()
      )
        return null;
      const row = db
        .prepare(
          "SELECT * FROM video_import_jobs WHERE status='queued' ORDER BY created_at LIMIT 1",
        )
        .get() as { id: string; input: string } | undefined;
      if (!row) return null;
      const claim = crypto.randomUUID();
      db.prepare(
        "UPDATE video_import_jobs SET status='running',claim=?,lease_until=?,updated_at=?,attempts=attempts+1 WHERE id=?",
      ).run(claim, now + 120000, now, row.id);
      return { ...row, claim };
    })
    .immediate();
  if (!job) return false;
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 600000);
  const heartbeat = setInterval(() => {
    const r = db
      .prepare(
        "UPDATE video_import_jobs SET lease_until=?,updated_at=? WHERE id=? AND status='running' AND claim=?",
      )
      .run(Date.now() + 120000, Date.now(), job.id, job.claim);
    if (!r.changes) ac.abort();
  }, 2000);
  try {
    const input = JSON.parse(job.input) as VideoInput;
    const source = await deps.collect(input, ac.signal);
    if (ac.signal.aborted) throw Error("任务已取消或超时");
    const candidate = await deps.generate(input, source, ac.signal);
    if (!candidate.title?.trim() || !candidate.content?.trim())
      throw Error("AI 没有返回完整候选稿");
    db.transaction(() => {
      if (
        ac.signal.aborted ||
        !db
          .prepare(
            "SELECT id FROM video_import_jobs WHERE id=? AND status='running' AND claim=?",
          )
          .get(job.id, job.claim)
      )
        throw Error("任务已取消或失去执行权限");
      const local = source.url.startsWith("local-video:");
      const publicUrl = local ? null : new URL(source.url);
      if (publicUrl && classifyVideo(source.url).kind === "mp4")
        publicUrl.search = "";
      const sources = `来源视频：${source.title}\n${publicUrl?.href || "本地上传视频（后台私有素材）"}\n整理依据：${source.method === "subtitles" ? "平台字幕" : source.method === "asr" ? "语音转写" : "用户补充字幕"}；未核验视频画面。`;
      // 公网视频可以直接发布成「视频」内容，并带上原平台链接；
      // 本地上传的视频目前没有可播放地址，先按普通文章存，避免发布时被闸门拦下。
      const isPublicVideo = !!publicUrl;
      const slug = deps.persist({
        slug: uniqueSlug(db, slugify(candidate.title)),
        title: candidate.title,
        description: "",
        date: new Date().toISOString().slice(0, 10),
        category: "教程",
        tags: [],
        cover: "",
        content: "",
        published: false,
        is_vip: false,
        views: 0,
        details: isPublicVideo
          ? { kind: "video", access: "public", sourceUrl: publicUrl.href }
          : { kind: "article", access: "public" },
        editorial: {
          source: source.text,
          sources,
          template: input.template,
          style: input.style,
          candidate: {
            title: candidate.title,
            description: candidate.description,
            content: candidate.content,
          },
          warnings: [
            ...(candidate.warnings || []),
            "本候选稿仅依据字幕或语音内容，视频画面和屏幕操作需人工核验。",
            ...(isPublicVideo
              ? []
              : [
                  "本地上传的视频暂无在线播放地址：发布前请在「内容资料」里填写播放地址，否则不会出现在视频栏目。",
                ]),
          ],
        },
      });
      db.prepare(
        "UPDATE video_import_jobs SET status='succeeded',post_slug=?,error='',updated_at=? WHERE id=? AND claim=?",
      ).run(slug, Date.now(), job.id, job.claim);
    })();
  } catch (error) {
    const e = error as Error;
    const message =
      e.name === "NeedsTranscript"
        ? e.message
        : e.message.startsWith("AI ") ||
            e.message.startsWith("来源") ||
            e.message.startsWith("任务")
          ? e.message
          : "采集或整理失败，请检查来源与 AI 配置后重试；未发布任何文章";
    db.prepare(
      "UPDATE video_import_jobs SET status=?,error=?,updated_at=? WHERE id=? AND status='running' AND claim=?",
    ).run(
      e.name === "NeedsTranscript" ? "needs_input" : "failed",
      message.slice(0, 500),
      Date.now(),
      job.id,
      job.claim,
    );
  } finally {
    clearTimeout(timer);
    clearInterval(heartbeat);
  }
  return true;
}
