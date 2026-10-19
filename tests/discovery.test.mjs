import test from "node:test";
import assert from "node:assert/strict";
import { canRead } from "../src/lib/access.ts";
import {
  searchablePost as match,
  readListState,
  listStateUrl,
} from "../src/lib/discovery.ts";
const searchablePost = (p, q, reader, now) =>
  match(p, q, canRead(p.details?.access || "public", reader, now));
test("正文只对有阅读权限的账号参与匹配，公开摘要仍可搜索", () => {
  const post = {
    title: "公开标题",
    description: "摘要",
    category: "教程",
    tags: ["部署"],
    content: "hidden-unique-body",
    details: { access: "member" },
  };
  assert.equal(searchablePost(post, "hidden-unique", null), false);
  assert.equal(
    searchablePost(post, "hidden-unique", { memberUntil: 99 }, 100),
    false,
  );
  assert.equal(
    searchablePost(post, "hidden-unique", { memberUntil: 101 }, 100),
    true,
  );
  assert.equal(searchablePost(post, "公开标题", null), true);
  assert.equal(
    searchablePost(
      { ...post, details: { access: "login" } },
      "hidden-unique",
      null,
    ),
    false,
  );
  assert.equal(
    searchablePost({ ...post, details: { access: "login" } }, "hidden-unique", {
      memberUntil: 0,
    }),
    true,
  );
  assert.equal(
    searchablePost(
      { ...post, details: { access: "public" } },
      "HIDDEN-unique",
      null,
    ),
    true,
  );
});
test("筛选网址往返保留视频类型，恶意页码回落，不重复编码中文", () => {
  const state = { query: "教程 & NAS", category: "随笔", page: 2 };
  const url = listStateUrl("https://example.com/videos?type=member", state);
  const parsed = new URL(url, "https://example.com");
  assert.equal(parsed.searchParams.get("type"), "member");
  assert.deepEqual(readListState(parsed.searchParams), state);
  assert.equal(readListState(new URLSearchParams("page=Infinity")).page, 1);
  assert.equal(readListState(new URLSearchParams("page=-2")).page, 1);
  assert.equal(
    listStateUrl(parsed.href, { query: "", category: "全部", page: 1 }),
    "/videos?type=member",
  );
});
