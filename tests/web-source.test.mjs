import test from "node:test";
import assert from "node:assert/strict";
import {
  extractArticle,
  parseFeed,
  readWebSource,
} from "../src/server/web-source.mjs";
const paragraph =
  "这是技术文章的详细说明，介绍如何使用 Node.js 环境进行开发。先安装依赖，再核对运行结果；文中的版本和命令需要保持准确。";
const html =
  "<html><head><title>部署笔记</title></head><body><nav>导航广告</nav><article><h1>部署笔记</h1><p>" +
  paragraph.repeat(5) +
  '</p><h2>开始操作</h2><pre><code class="language-sh">npm ci\nnode --version</code></pre><p><a href="/docs">文档</a></p><script>throw new Error("never execute")</script><img src="https://private.invalid/tracker"></article><footer>页脚广告</footer></body></html>';
test("正文抽取保留标题、代码和绝对链接，不执行脚本或带入图片广告", () => {
  const r = extractArticle(html, "https://example.com/blog/one");
  assert.equal(r.title, "部署笔记");
  assert.match(r.content, /npm ci\nnode --version/);
  assert.match(r.content, /https:\/\/example.com\/docs/);
  assert.equal(r.content.includes("never execute"), false);
  assert.equal(r.content.includes("tracker"), false);
  assert.equal(r.content.includes("导航广告"), false);
  assert.throws(
    () => extractArticle("<html><p>请登录</p></html>", "https://example.com/"),
    /正文/,
  );
});
test("RSS 与 Atom 只列出可选文章，去重并拒绝内网和非 HTTPS 链接", () => {
  const r = parseFeed(
    "<rss><channel><title>技术订阅</title><item><title>文章甲</title><link>https://example.com/a</link></item><item><title>重复</title><link>https://example.com/a#top</link></item><item><title>内网</title><link>https://127.0.0.1/a</link></item></channel></rss>",
    "https://example.com/feed",
  );
  assert.equal(r.items.length, 1);
  const a = parseFeed(
    '<feed xmlns="http://www.w3.org/2005/Atom"><title>Atom</title><entry><title>乙</title><link rel="alternate" href="/b"/></entry></feed>',
    "https://example.com/feed",
  );
  assert.equal(a.items[0].url, "https://example.com/b");
  assert.throws(
    () =>
      parseFeed(
        '<!DOCTYPE rss [<!ENTITY x "test">]><rss/>',
        "https://example.com/feed",
      ),
    /DOCTYPE|实体/,
  );
});
test("网络读取逐次使用受限请求；空壳网页和超长正文不冒充采集成功", async () => {
  let n = 0;
  const r = await readWebSource(
    "https://example.com/a",
    "article",
    undefined,
    async (url, opts) => {
      n++;
      assert.ok(opts.maxBytes <= 2 * 1024 * 1024);
      return { body: Buffer.from(html), finalUrl: url };
    },
  );
  assert.ok(r.content);
  assert.equal(n, 1);
  assert.throws(
    () =>
      extractArticle(
        "<article><p>" + paragraph.repeat(1000) + "</p></article>",
        "https://example.com/a",
      ),
    /40000/,
  );
});

test("表格参数保留、预定义 XML 实体链接正确解码", () => {
  const result = extractArticle(
    "<html><title>表格文章</title><article><p>" +
      paragraph.repeat(4) +
      "</p><table><tr><th>参数</th><th>值</th></tr><tr><td>version</td><td>22.0.0</td></tr></table></article></html>",
    "https://example.com/a",
  );
  assert.match(result.content, /\| 参数 \| 值 \|/);
  assert.match(result.content, /22.0.0/);
  const feed = parseFeed(
    "<rss><channel><title>A &amp; B</title><item><title>T</title><link>https://example.com/a?x=1&amp;y=2</link></item></channel></rss>",
    "https://example.com/feed",
  );
  assert.equal(feed.items[0].url, "https://example.com/a?x=1&y=2");
});

test("订阅数字实体以普通文字呈现，非法码点不抛异常", () => {
  const f = parseFeed(
    "<rss><channel><title>A &#8211; B</title><item><title>&#x4e2d;&#99999999;</title><link>https://example.com/a</link></item></channel></rss>",
    "https://example.com/feed",
  );
  assert.equal(f.title, "A – B");
  assert.match(f.items[0].title, /中/);
});

test("常见验证页面不被当作文章总结", () => {
  assert.throws(
    () =>
      extractArticle(
        "<html><title>Just a moment...</title><article><p>" +
          paragraph.repeat(5) +
          "</p></article></html>",
        "https://example.com/",
      ),
    /验证|登录/,
  );
});

test("RSS 全文与摘要区分，正文不必请求受限文章页", async () => {
  const xml =
    '<rss><channel><title>订阅</title><item><title>全文文章</title><link>https://example.com/a</link><description>这是摘要</description><content:encoded xmlns:content="x"><![CDATA[<p>' +
    paragraph.repeat(4) +
    "</p><pre><code>npm ci</code></pre>]]></content:encoded></item></channel></rss>";
  const { readFeedArticle } = await import("../src/server/web-source.mjs");
  let n = 0;
  const full = await readFeedArticle(
    "https://example.com/feed",
    "https://example.com/a",
    undefined,
    async () => {
      n++;
      return { body: Buffer.from(xml), finalUrl: "https://example.com/feed" };
    },
  );
  assert.equal(n, 1);
  assert.match(full.content, /npm ci/);
  assert.equal(full.method, "feed-full");
  assert.equal(
    parseFeed(xml, "https://example.com/feed").items[0].fullContent,
    undefined,
  );
  const summary = xml.replace(
    /<content:encoded[\s\S]*?<\/content:encoded>/,
    "",
  );
  assert.equal(
    await readFeedArticle(
      "https://example.com/feed",
      "https://example.com/a",
      undefined,
      async () => ({ body: Buffer.from(summary) }),
    ),
    null,
  );
});

test("网站首页发现同源订阅，只尝试一次且不跟随网页脚本", async () => {
  let visited = [];
  const r = await readWebSource(
    "https://example.com/",
    "feed",
    undefined,
    async (url) => {
      visited.push(url);
      return {
        finalUrl: url,
        body: Buffer.from(
          url.endsWith("/feed/")
            ? "<rss><channel><title>订阅</title><item><title>A</title><link>https://example.com/a</link></item></channel></rss>"
            : '<html><script>location.replace("https://evil.invalid")</script></html>',
        ),
      };
    },
  );
  assert.deepEqual(visited, [
    "https://example.com/",
    "https://example.com/feed/",
  ]);
  assert.equal(r.items.length, 1);
  await assert.rejects(
    readWebSource("https://example.com/", "feed", undefined, async (url) => ({
      finalUrl: url,
      body: Buffer.from("<html></html>"),
    })),
    /订阅|RSS/,
  );
});
test("Atom text 全文保留代码式尖括号，不当作 HTML 标签执行", async () => {
  const { readFeedArticle } = await import("../src/server/web-source.mjs");
  const xml =
    '<feed><title>Atom</title><entry><title>笔记</title><link href="https://example.com/a"/><content type="text"><![CDATA[' +
    paragraph.repeat(4) +
    " 路径 <project>/src]]></content></entry></feed>";
  const r = await readFeedArticle(
    "https://example.com/feed",
    "https://example.com/a",
    undefined,
    async () => ({ body: Buffer.from(xml) }),
  );
  assert.match(r.content, /project/);
});
