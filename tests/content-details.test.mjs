import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  normalizeDetails,
  validateDetailsForPublication,
} from "../src/lib/content-details.ts";
import { migratePostDetails } from "../src/server/post-migration.ts";
import { selectChannel, contentKind } from "../src/lib/catalog.ts";
test("显式内容类型决定专用栏目，旧文章继续按标签识别", () => {
  const base = {
    title: "样本",
    category: "随笔",
    tags: ["视频"],
    description: "",
    isVip: false,
  };
  assert.equal(contentKind(base), "video");
  assert.equal(
    selectChannel([{ ...base, details: { kind: "project" } }], "videos").length,
    0,
  );
  assert.equal(
    selectChannel([{ ...base, details: { kind: "project" } }], "projects")
      .length,
    1,
  );
  assert.equal(
    selectChannel(
      [{ ...base, details: { kind: "resource" }, isVip: true }],
      "resources",
    ).length,
    0,
  );
});
test("专用字段接受 HTTPS 和站内上传，拒绝脚本、不完整 URL 与非媒体视频地址", () => {
  assert.equal(
    normalizeDetails({
      kind: "video",
      videoUrl: "https://example.com/play.mp4?q=1",
    }).videoUrl,
    "https://example.com/play.mp4?q=1",
  );
  assert.equal(
    normalizeDetails({ kind: "video", videoUrl: "/uploads/demo.webm" })
      .videoUrl,
    "/uploads/demo.webm",
  );
  for (const v of [
    { kind: "oops" },
    { kind: "resource", downloadUrl: "javascript:alert(1)" },
    { kind: "project", repoUrl: "github.com/repo" },
    { kind: "video", videoUrl: "https://example.com/watch" },
  ])
    assert.throws(() => normalizeDetails(v));
  assert.equal(
    normalizeDetails({
      kind: "project",
      repoUrl: "https://github.com/a/b",
      license: " MIT ",
    }).license,
    "MIT",
  );
  assert.deepEqual(normalizeDetails(undefined), { kind: "auto" });
});
test("已有 SQLite 表只新增 details，保留正文、订单、阅读数，并可重复执行", () => {
  const db = new Database(":memory:");
  db.exec(
    "CREATE TABLE posts(slug TEXT PRIMARY KEY, content TEXT, views INTEGER); INSERT INTO posts VALUES('old','正文',42); CREATE TABLE orders(id TEXT); INSERT INTO orders VALUES('paid-order');",
  );
  migratePostDetails(db);
  migratePostDetails(db);
  assert.deepEqual(db.prepare("SELECT * FROM posts").get(), {
    slug: "old",
    content: "正文",
    views: 42,
    details: "{}",
  });
  assert.equal(db.prepare("SELECT count(*) n FROM orders").get().n, 1);
  db.close();
});

test("草稿可暂不填链接，发布时强制验证，旧文章不受影响", () => {
  for (const kind of ["video", "project", "resource"]) {
    assert.equal(validateDetailsForPublication({ kind }, false).kind, kind);
    assert.throws(() => validateDetailsForPublication({ kind }, true));
  }
  assert.equal(validateDetailsForPublication(undefined, true).kind, "auto");
});

test("本站私有文件地址可用于视频/下载；受限视频不能使用公开 uploads", () => {
  const url = "/api/files/12345678-1234-1234-1234-123456789abc";
  assert.equal(
    normalizeDetails({ kind: "video", videoUrl: url }).videoUrl,
    url,
  );
  assert.equal(
    normalizeDetails({ kind: "resource", downloadUrl: url }).downloadUrl,
    url,
  );
  assert.throws(() =>
    validateDetailsForPublication(
      { kind: "video", videoUrl: "/uploads/public.mp4", access: "member" },
      true,
    ),
  );
  assert.throws(() =>
    normalizeDetails({ kind: "resource", downloadUrl: "/api/files/../../a" }),
  );
});
