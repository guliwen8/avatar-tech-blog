import type Database from "better-sqlite3";
import crypto from "node:crypto";
import { normalizeWebUrl } from "./web-url.mjs";
export interface WebMaterial {
  url: string;
  title: string;
  content: string;
  byline?: string;
  method?: string;
  feedUrl?: string;
}
export function migrateWebImports(db: Database.Database) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS web_import_sources(url TEXT PRIMARY KEY,post_slug TEXT NOT NULL,created_at INTEGER NOT NULL)",
  );
}
export function findWebDraft(db: Database.Database, raw: string) {
  return db
    .prepare(
      "SELECT s.post_slug slug FROM web_import_sources s JOIN posts p ON p.slug=s.post_slug WHERE s.url=?",
    )
    .get(normalizeWebUrl(raw)) as { slug: string } | undefined;
}
export function saveWebDraft(
  db: Database.Database,
  requested: string,
  material: WebMaterial,
  persist: (post: any) => void,
) {
  const original = normalizeWebUrl(requested),
    url = normalizeWebUrl(material.url);
  return db
    .transaction(() => {
      const old = findWebDraft(db, original) || findWebDraft(db, url);
      if (old) return { ...old, reused: true };
      const slug = "web-source-" + crypto.randomUUID();
      const sources = `原标题：${material.title}\n来源：${url}${material.byline ? "\n原作者：" + material.byline : ""}\n${material.method === "feed-full" ? "由公开 RSS 全文提取；订阅：" + material.feedUrl : "由网页正文提取"}，未独立核验事实；发布前核对来源与引用。`;
      persist({
        slug,
        title: material.title,
        description: "",
        date: new Date().toISOString().slice(0, 10),
        category: "教程",
        tags: [],
        cover: "",
        content: "",
        published: false,
        is_vip: false,
        views: 0,
        details: { kind: "article", access: "public" },
        editorial: {
          source: material.content,
          sources,
          template: "tutorial",
          style: "auto",
          warnings: [],
        },
      });
      for (const key of new Set([original, url]))
        db.prepare(
          "INSERT INTO web_import_sources(url,post_slug,created_at) VALUES(?,?,?) ON CONFLICT(url) DO UPDATE SET post_slug=excluded.post_slug,created_at=excluded.created_at",
        ).run(key, slug, Date.now());
      return { slug, reused: false };
    })
    .immediate();
}
export function storeWebCandidate(
  db: Database.Database,
  slug: string,
  source: string,
  candidate: any,
) {
  return db
    .transaction(() => {
      const post = db
        .prepare(
          "SELECT editorial FROM posts WHERE slug=? AND published=0 AND content=?",
        )
        .get(slug, "") as { editorial: string } | undefined;
      if (!post)
        throw Error("素材已被编辑或发布，请到文章编辑页处理，未覆盖现有内容");
      const original = post.editorial;
      const data = JSON.parse(original);
      if (data.source !== source || data.candidate)
        throw Error("素材或候选稿已变更，请到文章编辑页处理，未覆盖现有内容");
      data.candidate = {
        title: candidate.title,
        description: candidate.description,
        content: candidate.content,
      };
      data.warnings = candidate.warnings || [];
      const r = db
        .prepare(
          "UPDATE posts SET editorial=? WHERE slug=? AND editorial=? AND published=0 AND content=?",
        )
        .run(JSON.stringify(data), slug, original, "");
      if (!r.changes) throw Error("素材已经变更，请重新打开草稿");
      return true;
    })
    .immediate();
}
