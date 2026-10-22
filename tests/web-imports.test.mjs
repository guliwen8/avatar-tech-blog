import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  migrateWebImports,
  saveWebDraft,
  findWebDraft,
  storeWebCandidate,
} from "../src/server/web-imports.ts";
const db = () => {
  const d = new Database(":memory:");
  d.exec(
    "CREATE TABLE posts(slug TEXT PRIMARY KEY,published INTEGER,content TEXT,editorial TEXT)",
  );
  migrateWebImports(d);
  return d;
};
test("采集只写私有素材草稿，链接去重且不覆盖已发布文章", () => {
  const d = db();
  let post;
  const persist = (p) => {
    post = p;
    d.prepare("INSERT INTO posts VALUES(?,?,?,?)").run(
      p.slug,
      p.published ? 1 : 0,
      p.content,
      JSON.stringify(p.editorial),
    );
  };
  const m = {
    url: "https://example.com/a",
    title: "原文标题",
    content: "原始正文素材",
    byline: "作者",
  };
  const r = saveWebDraft(d, m.url + "?utm_source=x", m, persist);
  assert.equal(post.published, false);
  assert.equal(post.content, "");
  assert.equal(post.editorial.source, m.content);
  assert.match(post.editorial.sources, /作者/);
  assert.equal(
    saveWebDraft(d, m.url, m, () => assert.fail("不能重复保存")).slug,
    r.slug,
  );
  storeWebCandidate(d, r.slug, m.content, {
    title: "新标题",
    description: "摘要",
    content: "重新组织的正文",
    warnings: [],
  });
  assert.equal(d.prepare("SELECT content FROM posts").get().content, "");
  assert.throws(
    () =>
      storeWebCandidate(d, r.slug, m.content, {
        title: "覆盖",
        content: "覆盖",
      }),
    /变更/,
  );
  d.prepare("UPDATE posts SET published=1").run();
  assert.equal(findWebDraft(d, m.url).slug, r.slug);
  d.close();
});
test("素材保存错误整体回滚，原正文已修改时拒绝覆盖", () => {
  const d = db();
  assert.throws(() =>
    saveWebDraft(
      d,
      "https://example.com/a",
      { url: "https://example.com/a", title: "标题", content: "原始素材" },
      (p) => {
        d.prepare("INSERT INTO posts VALUES(?,?,?,?)").run(p.slug, 0, "", "{}");
        throw Error("failure");
      },
    ),
  );
  assert.equal(d.prepare("SELECT COUNT(*) n FROM posts").get().n, 0);
  assert.equal(
    d.prepare("SELECT COUNT(*) n FROM web_import_sources").get().n,
    0,
  );
  d.prepare("INSERT INTO posts VALUES(?,?,?,?)").run(
    "edited",
    0,
    "用户正在编辑",
    JSON.stringify({ source: "原稿" }),
  );
  assert.throws(
    () =>
      storeWebCandidate(d, "edited", "原稿", {
        title: "候选",
        content: "内容",
      }),
    /编辑/,
  );
  d.close();
});
