import crypto from "node:crypto";
import type Database from "better-sqlite3";
import { getDB } from "./db";
import { getSettings, listPosts, upsertPost, setSetting } from "./repo";
import {
  DEFAULT_FEED_SOURCES,
  enabledSources,
  normalizeFeedSources,
  type FeedSource,
} from "../lib/feed-sources";
import { rankTopics, type ScoreContext } from "../lib/topic-score";
import { readWebSource } from "./web-source.mjs";

/**
 * 线③：自动采集资讯并生成待审草稿。
 *
 * 安全边界
 * - 只在服务端运行，抓取走已有的 publicRequest（自带私网地址拦截）。
 * - 产出的文章一律 published=false，必须人工过闸门才能发布。
 * - 每条草稿在 editorial 里写入来源与「未独立核验」提示，保留溯源。
 * - 已采集过的 URL 记录在 web_import_sources，永不重复入库。
 */

export const COLLECT_MIN_SCORE = 45;
export const COLLECT_LIMIT = 3;
const FETCH_CONCURRENCY = 4;

export interface CollectOptions {
  /** 本次最多生成几篇草稿 */
  limit?: number;
  /** 低于该分数不进草稿池 */
  minScore?: number;
  /** 只打分不建稿 */
  dryRun?: boolean;
}

export interface RankedTopic {
  title: string;
  url: string;
  source: string;
  total: number;
  reasons: string[];
}

export interface CollectReport {
  ranAt: string;
  sourceCount: number;
  fetchedItems: number;
  skippedImported: number;
  ranked: RankedTopic[];
  created: Array<{ slug: string; title: string; total: number }>;
  errors: Array<{ source: string; error: string }>;
}

interface Candidate {
  title: string;
  url: string;
  date?: string;
  summary?: string;
  sourceId: string;
  sourceName: string;
  sourceWeight: number;
}

/** 有限并发执行，避免同时打几十个站点。 */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from(
    { length: Math.min(limit, items.length) },
    async () => {
      while (cursor < items.length) {
        const index = cursor++;
        out[index] = await fn(items[index]);
      }
    },
  );
  await Promise.all(workers);
  return out;
}

function migrate(db: Database.Database) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS web_import_sources(url TEXT PRIMARY KEY,post_slug TEXT NOT NULL,created_at INTEGER NOT NULL)",
  );
}

function alreadyImported(db: Database.Database, url: string): boolean {
  return !!db
    .prepare("SELECT 1 FROM web_import_sources WHERE url=?")
    .get(url);
}

/** 站点词汇：标签 + 分类 + 近期标题，用于判断「跟我相关」。 */
function siteVocabulary(db: Database.Database): string[] {
  const words = new Set<string>();
  for (const p of listPosts(false).slice(0, 60)) {
    if (p.category) words.add(p.category);
    for (const t of p.tags) words.add(String(t));
  }
  const rows = db
    .prepare("SELECT key,value FROM settings WHERE key IN ('siteKeywords')")
    .get() as { value?: string } | undefined;
  if (rows?.value) {
    for (const w of rows.value.split(/[,，\s]+/)) if (w) words.add(w);
  }
  return [...words].filter((w) => w.trim().length >= 2);
}

function recentTitles(db: Database.Database): string[] {
  return listPosts(false)
    .slice(0, 50)
    .map((p) => p.title);
}

/** 生成可读 slug，冲突时追加序号。 */
function uniqueSlug(db: Database.Database, title: string): string {
  const base =
    title
      .trim()
      .toLowerCase()
      .replace(/[^\w]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "collected-" + Date.now();
  let slug = base;
  let n = 2;
  while (db.prepare("SELECT 1 FROM posts WHERE slug=?").get(slug))
    slug = `${base}-${n++}`;
  return slug;
}

function attribution(source: FeedSource, item: Candidate): string {
  return [
    `原标题：${item.title}`,
    `来源：${item.url}`,
    `订阅：${source.name}（${source.url}）`,
    item.date ? `原发布时间：${item.date}` : "",
    "由自动采集生成，未独立核验事实；发布前请核对来源、补充自己的验证与表述。",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function collectFeeds(
  options: CollectOptions = {},
  signal?: AbortSignal,
): Promise<CollectReport> {
  const db = getDB();
  migrate(db);

  const limit = Math.max(1, Math.min(10, options.limit ?? COLLECT_LIMIT));
  const minScore = Math.max(0, Math.min(100, options.minScore ?? COLLECT_MIN_SCORE));

  const stored = getSettings().feedSources;
  const sources = enabledSources(
    stored ? normalizeFeedSources(stored) : DEFAULT_FEED_SOURCES,
  );

  const report: CollectReport = {
    ranAt: new Date().toISOString(),
    sourceCount: sources.length,
    fetchedItems: 0,
    skippedImported: 0,
    ranked: [],
    created: [],
    errors: [],
  };

  // 1) 抓取所有订阅
  const perSource = await mapLimit(sources, FETCH_CONCURRENCY, async (source) => {
    try {
      const feed = (await readWebSource(source.url, "feed", signal)) as {
        items?: Array<{ title: string; url: string; date?: string }>;
      };
      const items: Candidate[] = (feed.items ?? []).map(
        (it: { title: string; url: string; date?: string }) => ({
          title: it.title,
          url: it.url,
          date: it.date,
          summary: "",
          sourceId: source.id,
          sourceName: source.name,
          sourceWeight: source.weight,
        }),
      );
      return items;
    } catch (error) {
      report.errors.push({
        source: source.name,
        error: error instanceof Error ? error.message : "抓取失败",
      });
      return [] as Candidate[];
    }
  });

  // 2) 展平 + 去重（已入库的、本次重复的）
  const seen = new Set<string>();
  const candidates: Candidate[] = [];
  for (const batch of perSource) {
    for (const item of batch) {
      report.fetchedItems++;
      if (seen.has(item.url)) {
        report.skippedImported++;
        continue;
      }
      seen.add(item.url);
      if (alreadyImported(db, item.url)) {
        report.skippedImported++;
        continue;
      }
      candidates.push(item);
    }
  }

  if (!candidates.length) return report;

  // 3) 打分排序
  const ctx: ScoreContext = {
    keywords: siteVocabulary(db),
    now: Date.now(),
    recentTitles: recentTitles(db),
  };
  const ranked = rankTopics(
    candidates.map((c) => ({
      title: c.title,
      summary: c.summary,
      date: c.date,
      sourceWeight: c.sourceWeight,
      _c: c,
    })),
    ctx,
  );

  report.ranked = ranked.slice(0, 20).map((r) => ({
    title: r.title,
    url: r._c.url,
    source: r._c.sourceName,
    total: r.score.total,
    reasons: r.score.reasons,
  }));

  if (options.dryRun) return report;

  // 4) 只给高分项建稿
  const picked = ranked.filter((r) => r.score.total >= minScore).slice(0, limit);

  for (const item of picked) {
    if (signal?.aborted) break;
    const c = item._c;
    try {
      // 抓正文（拿到真实内容才建稿，否则草稿是空的没意义）
      const article = (await readWebSource(c.url, "article", signal)) as {
        content?: string;
      };
      const content = String(article?.content ?? "").trim();
      if (!content) {
        report.errors.push({
          source: c.sourceName,
          error: `未取得正文：${c.title}`,
        });
        continue;
      }
      const source = sources.find((s) => s.id === c.sourceId);
      const slug = uniqueSlug(db, c.title);
      upsertPost({
        slug,
        title: c.title.slice(0, 200),
        date: new Date().toISOString().slice(0, 10),
        category: "教程",
        tags: [],
        description: "",
        cover: "",
        content: "",
        published: false,
        is_vip: false,
        views: 0,
        details: { kind: "article", access: "public" },
        editorial: {
          source: content,
          sources: source ? attribution(source, c) : `来源：${c.url}`,
          template: "tutorial",
          style: "auto",
          warnings: ["自动采集草稿：事实未经独立核验，发布前请自行验证。"],
        },
      });
      db.prepare(
        "INSERT INTO web_import_sources(url,post_slug,created_at) VALUES(?,?,?) ON CONFLICT(url) DO UPDATE SET post_slug=excluded.post_slug,created_at=excluded.created_at",
      ).run(c.url, slug, Date.now());
      report.created.push({ slug, title: c.title, total: item.score.total });
    } catch (error) {
      report.errors.push({
        source: c.sourceName,
        error: `建稿失败：${error instanceof Error ? error.message : c.title}`,
      });
    }
  }

  setSetting("feedLastRun", report.ranAt);
  return report;
}

/** 保存订阅源清单（供后台设置页调用）。 */
export function saveFeedSources(raw: unknown): number {
  const list = normalizeFeedSources(raw);
  setSetting("feedSources", JSON.stringify(list));
  return list.length;
}

export function readFeedSources() {
  const stored = getSettings().feedSources;
  return stored ? normalizeFeedSources(stored) : DEFAULT_FEED_SOURCES;
}

/** 派生一个稳定的运行编号，便于日志关联。 */
export function newRunId(): string {
  return crypto.randomUUID().slice(0, 8);
}
