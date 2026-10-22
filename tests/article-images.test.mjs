import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  getImageConfig,
  saveImageConfig,
  generateArticleImage,
} from "../src/server/article-images.ts";
import { saveAIConfig } from "../src/server/editorial-ai.ts";
import {
  migrateFiles,
  bindPostFiles,
  fileReadable,
  getPrivateFile,
  deletePrivateFile,
} from "../src/server/private-files.ts";
import {
  imageSuggestions,
  imagePrompt,
  normalizeArticleImage,
  insertArticleImage,
} from "../src/lib/article-images.ts";

test("图片方案从文章章节生成，过滤代码标题，提示词有界且可编辑", () => {
  const article = {
    title: "NAS 部署",
    description: "Docker 部署教程",
    content:
      "## 环境准备\n准备机器。\n```sh\n## secret heading\n```\n## 部署步骤\n启动容器。",
  };
  const plans = imageSuggestions(article);
  assert.equal(plans[0].role, "cover");
  assert.ok(plans.some((x) => x.section === "部署步骤"));
  assert.ok(!plans.some((x) => x.section === "secret heading"));
  assert.match(imagePrompt(article, plans[1]), /浅蓝/);
  assert.ok(
    imagePrompt({ ...article, content: "字".repeat(50000) }, plans[0]).length <=
      1500,
  );
  assert.throws(() =>
    normalizeArticleImage({ url: "https://evil.test/a", role: "cover" }),
  );
});
test("图像配置独立、默认关闭、密钥不回传，不修改文字配置", () => {
  const db = new Database(":memory:");
  saveAIConfig(db, {
    baseUrl: "https://api.minimax.cn/v1",
    model: "MiniMax-M2.7",
    apiKey: "fake-text-key",
    enabled: true,
  });
  assert.equal(getImageConfig(db).enabled, false);
  const result = saveImageConfig(db, {
    baseUrl: "https://api.minimax.cn/v1",
    enabled: true,
    useTextKey: true,
  });
  assert.equal(result.ready, true);
  assert.ok(!JSON.stringify(result).includes("fake-text-key"));
  assert.throws(() =>
    saveImageConfig(db, {
      baseUrl: "https://evil.example/v1",
      enabled: true,
      useTextKey: true,
    }),
  );
  assert.equal(
    db
      .prepare("select value from editorial_ai_config")
      .get()
      .value.includes("fake-text-key"),
    true,
  );
  db.close();
});
test("生成只请求一张图、保存私有文件，采用并发布后才可读，正文跟随会员权限", async () => {
  const db = new Database(":memory:");
  migrateFiles(db);
  db.exec(
    "CREATE TABLE posts(slug TEXT PRIMARY KEY,published INTEGER,details TEXT,cover TEXT,content TEXT)",
  );
  const root = await mkdtemp(path.join(tmpdir(), "avatar-image-"));
  const png = Buffer.from("89504e470d0a1a0a0000000000000000", "hex");
  let calls = 0;
  const deps = {
    request: async (url, opts) => {
      calls++;
      if (calls === 1) {
        assert.match(url, /\/v1\/image_generation$/);
        const p = JSON.parse(opts.body);
        assert.equal(p.n, 1);
        assert.equal(p.model, "image-01");
        assert.equal(p.aspect_ratio, "16:9");
        assert.equal(opts.redirects, 0);
        return {
          body: Buffer.from(
            JSON.stringify({
              base_resp: { status_code: 0 },
              data: { image_urls: ["https://cdn.example/image.png"] },
            }),
          ),
        };
      }
      assert.equal(opts.headers?.Authorization, undefined);
      return { body: png };
    },
  };
  try {
    const image = await generateArticleImage(
      db,
      root,
      {
        baseUrl: "https://api.minimax.cn/v1",
        apiKey: "fake-image-key",
        enabled: true,
        useTextKey: false,
      },
      {
        prompt: "浅蓝色 NAS 科技插画",
        role: "body",
        caption: "部署示意图",
        section: "部署步骤",
      },
      undefined,
      deps,
    );
    assert.equal(calls, 2);
    let file = getPrivateFile(db, image.id);
    assert.equal(fileReadable(db, file, { admin: false }), false);
    db.prepare("INSERT INTO posts VALUES(?,?,?,?,?)").run(
      "a",
      0,
      JSON.stringify({ access: "member" }),
      "",
      `![示意图](${image.url})`,
    );
    bindPostFiles(
      db,
      "a",
      {},
      { cover: "", content: `![示意图](${image.url})` },
    );
    file = getPrivateFile(db, image.id);
    assert.equal(fileReadable(db, file, { admin: false }), false);
    db.prepare("UPDATE posts SET published=1").run();
    assert.equal(fileReadable(db, file, { admin: false }), false);
    assert.equal(
      fileReadable(db, file, {
        admin: false,
        memberId: "m",
        memberUntil: Date.now() + 10000,
      }),
      true,
    );
    await assert.rejects(
      () => deletePrivateFile(db, root, image.id, { admin: true }),
      /移除/,
    );
    db.prepare("UPDATE posts SET cover=?,content=?").run(image.url, "");
    assert.equal(fileReadable(db, file, { admin: false }), true);
    db.prepare("UPDATE posts SET cover=?").run("");
    assert.equal(fileReadable(db, file, { admin: false }), false);
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
});
test("不采用服务商失败响应、伪图片或取消结果，不自动重试", async () => {
  const db = new Database(":memory:");
  migrateFiles(db);
  const root = await mkdtemp(path.join(tmpdir(), "avatar-image-"));
  const config = {
    baseUrl: "https://api.minimax.cn/v1",
    apiKey: "fake",
    enabled: true,
    useTextKey: false,
  };
  let calls = 0;
  try {
    await assert.rejects(
      () =>
        generateArticleImage(
          db,
          root,
          config,
          { prompt: "插画", role: "cover", caption: "封面", section: "" },
          undefined,
          {
            request: async () => {
              calls++;
              return {
                body: Buffer.from(
                  JSON.stringify({
                    base_resp: {
                      status_code: 1004,
                      status_msg: "private-provider-details",
                    },
                  }),
                ),
              };
            },
          },
        ),
      /密钥/,
    );
    assert.equal(calls, 1);
    await assert.rejects(
      () =>
        generateArticleImage(
          db,
          root,
          config,
          { prompt: "插画", role: "cover", caption: "封面", section: "" },
          undefined,
          {
            request: async (url) => ({
              body: url.includes("image_generation")
                ? Buffer.from(
                    JSON.stringify({
                      base_resp: { status_code: 0 },
                      data: { image_urls: ["https://cdn.example/a.png"] },
                    }),
                  )
                : Buffer.from("<html>not an image</html>"),
            }),
          },
        ),
      /图片/,
    );
    const ac = new AbortController();
    ac.abort();
    await assert.rejects(
      () =>
        generateArticleImage(
          db,
          root,
          config,
          { prompt: "插画", role: "cover", caption: "封面", section: "" },
          ac.signal,
        ),
      /取消/,
    );
    assert.equal(db.prepare("SELECT count(*) n FROM private_files").get().n, 0);
  } finally {
    db.close();
    await rm(root, { recursive: true, force: true });
  }
});

test("正文配图插入章节且不进入代码；重复采用不重复插图",()=>{
 const image={id:"12345678-1234-1234-1234-123456789abc",url:"/api/files/12345678-1234-1234-1234-123456789abc",role:"body",caption:"环境准备",section:"环境准备",prompt:"示意图"};
 const source="```sh\n## 环境准备\n```\n\n## 环境准备\n\n准备机器。";
 const actual=insertArticleImage(source,image);
 assert.ok(actual.startsWith("```sh\n## 环境准备\n```"));
 assert.ok(actual.indexOf(image.url)>actual.lastIndexOf("## 环境准备"));
 assert.equal(insertArticleImage(actual,image),actual);
});

test("无标题小节仍可生成正文图，配图提示不回传已有图片链接",()=>{
 const article={title:"随笔",description:"观察记录",content:"一些观察。\n![旧图](/api/files/12345678-1234-1234-1234-123456789abc)"};
 const plans=imageSuggestions(article);assert.ok(plans.some(p=>p.role==="body"));
 assert.ok(!imagePrompt(article,plans[0]).includes("/api/files/"));
});
