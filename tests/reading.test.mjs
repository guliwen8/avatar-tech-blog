import test from "node:test";
import assert from "node:assert/strict";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import rehypeStringify from "rehype-stringify";
import { readingStructure, safeCover } from "../src/lib/reading.ts";
test("目录保留中文、行内代码及重复标题，并与正文锚点一致", async () => {
  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(readingStructure)
    .use(rehypeStringify)
    .process("## 部署 `Docker`\n\n### 部署 Docker\n\n## 部署 Docker");
  assert.deepEqual(
    file.data.toc.map((x) => x.id),
    ["section-1", "section-2", "section-3"],
  );
  assert.equal(file.data.toc[0].text, "部署 Docker");
  for (const item of file.data.toc)
    assert.ok(String(file).includes(`id="${item.id}"`));
});
test("资料仅收集安全外链并去重，视频仅识别 HTTPS 媒体文件", async () => {
  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(readingStructure)
    .use(rehypeStringify)
    .process(
      "[项目](https://github.com/example/repo)\n\n[重复](https://github.com/example/repo)\n\n[演示](https://example.com/demo.mp4?x=1)\n\n[危险](javascript:alert)\n\n[本地](http://127.0.0.1:3000/admin)",
    );
  assert.equal(file.data.resources.length, 2);
  assert.equal(file.data.resources[1].video, true);
});
test("封面拒绝后台、混合内容、私网地址，保留站内上传与 HTTPS 图片", () => {
  for (const url of [
    "http://100.78.126.117:3000/admin",
    "https://example.com/admin",
    "javascript:alert(1)",
    "https://127.0.0.1/a.png",
    "//example.com/a.jpg",
  ])
    assert.equal(safeCover(url), undefined);
  assert.equal(safeCover("/uploads/a.png"), "/uploads/a.png");
  assert.equal(
    safeCover("https://images.unsplash.com/photo-test?w=800"),
    "https://images.unsplash.com/photo-test?w=800",
  );
});

test("受控站内图片地址可用于封面，其他 API 路径仍被拒绝", () => {
 assert.equal(safeCover("/api/files/12345678-1234-1234-1234-123456789abc"),"/api/files/12345678-1234-1234-1234-123456789abc");
 assert.equal(safeCover("/api/admin/config"),undefined);
});
