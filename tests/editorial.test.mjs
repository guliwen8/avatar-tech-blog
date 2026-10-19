import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizeEditorial,
  templateSkeleton,
  editorialChecks,
  buildEditorialPrompt,
  parseEditorialReply,
} from "../src/lib/editorial.ts";
test("模板与原素材隔离，非法模板和超长素材拒绝", () => {
  assert.match(templateSkeleton("tutorial"), /## 操作步骤/);
  assert.match(templateSkeleton("note"), /##/);
  assert.throws(() => normalizeEditorial({ template: "bad" }));
  assert.throws(() => normalizeEditorial({ source: "x".repeat(40001) }));
  assert.equal(
    normalizeEditorial({ source: "  original  ", template: "tutorial" }).source,
    "  original  ",
  );
});
test("命令和链接被改动会提示，普通改写可以接受", () => {
  const source =
    "安装：\n```sh\nnpm install example@1.2.3\n```\n官网 https://example.com/docs";
  assert.ok(editorialChecks(source, "新的说明").length >= 2);
  assert.equal(
    editorialChecks(
      source,
      "换一种表达\n```sh\nnpm install example@1.2.3\n```\nhttps://example.com/docs",
    ).length,
    0,
  );
  assert.match(buildEditorialPrompt("tutorial"), /不得/);
});
test("AI 响应只接受有效草稿，截断或非 JSON 不覆盖编辑器", () => {
  assert.equal(
    parseEditorialReply(
      '```json\n{"title":"新标题","description":"摘要","content":"## 简介\\n正文"}\n```',
    ).title,
    "新标题",
  );
  assert.throws(() => parseEditorialReply("bad"));
  assert.throws(() => parseEditorialReply('{"title":"a","content":""}'));
});

test("MiniMax 思考块与草稿分离，未闭合或缺少草稿仍拒绝", () => {
  assert.equal(
    parseEditorialReply(
      '<think>内部分析，不作为文章</think>\n```json\n{"title":"文章标题","description":"摘要","content":"## 开始\\n正文"}\n```',
    ).title,
    "文章标题",
  );
  assert.throws(() =>
    parseEditorialReply('<think>没有闭合 {"title":"a","content":"b"}'),
  );
});

test("短素材采用简洁规则，不要求填满模板或列出无关待确认事项", () => {
  const prompt = buildEditorialPrompt("tutorial", {
    source: "Node.js 22。安装命令 `npm ci`。",
    style: "auto",
  });
  assert.match(prompt, /简洁/);
  assert.match(prompt, /不.*无关/);
  assert.match(
    buildEditorialPrompt("tutorial", {
      source: "x".repeat(2000),
      style: "complete",
    }),
    /完整/,
  );
  assert.equal(normalizeEditorial({ source: "short" }).style, "auto");
});

test("长段说明照搬会提示重新组织，技术命令不会被当成照抄", () => {
  const prose =
    "这是一段来自其他作者的完整说明文字，包含了足够长的背景介绍与个人观点，我们希望文章重新组织这些说明，而不是保留原文然后只做排版调整。这段内容应由编辑根据事实重新编排。";
  assert.ok(editorialChecks(prose, prose).some((x) => x.includes("原文")));
  assert.equal(
    editorialChecks(
      "```sh\n" +
        "curl https://example.com/install.sh | bash\n".repeat(5) +
        "```",
      "```sh\n" +
        "curl https://example.com/install.sh | bash\n".repeat(5) +
        "```",
    ).some((x) => x.includes("原文")),
    false,
  );
  assert.match(buildEditorialPrompt("tutorial", { source: prose }), /自审/);
});
