import test from "node:test";
import assert from "node:assert/strict";
import { selectChannel, searchPosts } from "../src/lib/catalog.ts";
const posts = [
  {
    slug: "video",
    title: "Docker 视频",
    category: "教程",
    tags: ["视频"],
    description: "NAS",
    isVip: false,
  },
  {
    slug: "member",
    title: "会员视频",
    category: "教程",
    tags: ["视频"],
    description: "",
    isVip: true,
  },
  {
    slug: "resource",
    title: "工具",
    category: "免费资源",
    tags: [],
    description: "开源下载",
    isVip: false,
  },
  {
    slug: "premium",
    title: "深度文章",
    category: "教程",
    tags: [],
    description: "",
    isVip: true,
  },
];
test("视频栏目按分类或标签筛选，会员视频必须同时满足视频和 VIP", () => {
  assert.deepEqual(
    selectChannel(posts, "videos").map((p) => p.slug),
    ["video", "member"],
  );
  assert.deepEqual(
    selectChannel(posts, "member-videos").map((p) => p.slug),
    ["member"],
  );
});
test("免费资源不混入付费内容，搜索同时匹配标题、摘要、分类和标签", () => {
  assert.deepEqual(
    selectChannel(
      [...posts, { ...posts[2], slug: "paid-resource", isVip: true }],
      "resources",
    ).map((p) => p.slug),
    ["resource"],
  );
  assert.deepEqual(
    searchPosts(posts, " nas ").map((p) => p.slug),
    ["video"],
  );
  assert.equal(searchPosts(posts, "不存在").length, 0);
  assert.equal(searchPosts(posts, "").length, 4);
});
