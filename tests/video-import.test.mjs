import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  classifyVideo,
  transcriptText,
  collectVideo,
  NeedsTranscript,
} from "../src/server/video-source.mjs";
import { publicRequest, publicAddress } from "../src/server/video-http.mjs";
import {
  migrateVideoJobs,
  enqueueVideoJob,
  listVideoJobs,
  cancelVideoJob,
  retryVideoJob,
  runVideoJob,
} from "../src/server/video-jobs.ts";
test("三种视频 URL 规范化；拒绝内网、非视频和注入式链接", () => {
  assert.equal(
    classifyVideo("https://youtu.be/abcdefghijk?t=1").url,
    "https://www.youtube.com/watch?v=abcdefghijk",
  );
  assert.equal(
    classifyVideo("https://www.bilibili.com/video/BV1234567890/").kind,
    "bilibili",
  );
  assert.equal(
    classifyVideo("https://cdn.example.com/a.mp4?sign=x").kind,
    "mp4",
  );
  for (const s of [
    "http://127.0.0.1/a.mp4",
    "https://localhost/a.mp4",
    "https://127.0.0.1/a.mp4",
    "https://example.com/page",
    "https://youtube.com/playlist?list=1",
  ])
    assert.throws(() => classifyVideo(s));
  assert.equal(publicAddress("169.254.169.254", 4), false);
});
test("解析 json3、B站字幕、SRT；缺失与超长不伪造或静默截断", () => {
  assert.equal(
    transcriptText(
      JSON.stringify({
        events: [
          { segs: [{ utf8: "第一段字幕内容。" }] },
          { segs: [{ utf8: "第二段字幕内容。" }] },
        ],
      }),
    ),
    "第一段字幕内容。\n第二段字幕内容。",
  );
  assert.match(
    transcriptText("1\n00:00:01,000 --> 00:00:02,000\n这是一段字幕内容测试。"),
    /字幕/,
  );
  assert.throws(() => transcriptText(""), NeedsTranscript);
  assert.throws(() => transcriptText("x".repeat(40001)), NeedsTranscript);
});
test("字幕优先、补字幕不联网、无字幕需要人工或显式转写", async () => {
  let fetched = 0;
  const result = await collectVideo(
    { url: "https://youtu.be/abcdefghijk" },
    {
      tool: async () =>
        JSON.stringify({
          title: "标题",
          duration: 60,
          subtitles: {
            zh: [{ ext: "json3", url: "https://cdn.example.com/a.json" }],
          },
        }),
      fetcher: async () => {
        fetched++;
        return {
          body: Buffer.from(
            JSON.stringify({
              events: [{ segs: [{ utf8: "这是实际字幕中的知识内容。" }] }],
            }),
          ),
        };
      },
    },
  );
  assert.equal(result.method, "subtitles");
  assert.equal(fetched, 1);
  const manual = await collectVideo(
    {
      url: "https://cdn.example.com/a.mp4",
      transcript: "这是管理员补充的视频字幕内容。",
    },
    { fetcher: () => assert.fail("不应联网") },
  );
  assert.equal(manual.method, "provided");
  await assert.rejects(
    () => collectVideo({ url: "https://cdn.example.com/a.mp4" }),
    NeedsTranscript,
  );
});
function db() {
  const d = new Database(":memory:");
  migrateVideoJobs(d);
  d.exec(
    "CREATE TABLE drafts(slug TEXT PRIMARY KEY,published INTEGER,body TEXT)",
  );
  return d;
}
test("队列去重、只创建候选草稿、失败/取消不发布", async () => {
  const d = db();
  const input = {
    url: "https://cdn.example.com/a.mp4",
    template: "tutorial",
    style: "auto",
    transcript: "有效字幕内容至少十个字符",
  };
  const a = enqueueVideoJob(d, input);
  assert.equal(enqueueVideoJob(d, input).id, a.id);
  let saw;
  const deps = {
    collect: async () => ({
      text: "有效字幕内容至少十个字符",
      method: "provided",
      title: "标题",
      url: input.url,
    }),
    generate: async () => ({
      title: "候选",
      description: "摘要",
      content: "## 正文\n内容",
      warnings: [],
    }),
    persist: (post) => {
      saw = post;
      d.prepare("INSERT INTO drafts VALUES(?,?,?)").run(
        post.slug,
        post.published ? 1 : 0,
        post.content,
      );
      return post.slug;
    },
  };
  await runVideoJob(d, deps);
  assert.equal(saw.published, false);
  assert.equal(saw.content, "");
  assert.match(saw.editorial.candidate.content, /正文/);
  assert.equal(listVideoJobs(d)[0].status, "succeeded");
  assert.equal(d.prepare("SELECT published FROM drafts").get().published, 0);
  const b = enqueueVideoJob(d, {
    ...input,
    url: "https://cdn.example.com/b.mp4",
  });
  cancelVideoJob(d, b.id);
  await runVideoJob(d, deps);
  assert.equal(listVideoJobs(d).find((x) => x.id === b.id).status, "cancelled");
  const c = enqueueVideoJob(d, {
    ...input,
    url: "https://cdn.example.com/c.mp4",
  });
  await runVideoJob(d, {
    ...deps,
    collect: async () => {
      throw new NeedsTranscript("需要字幕");
    },
  });
  assert.equal(
    listVideoJobs(d).find((x) => x.id === c.id).status,
    "needs_input",
  );
  retryVideoJob(d, c.id, "补充的字幕材料足够长");
  assert.equal(listVideoJobs(d).find((x) => x.id === c.id).status, "queued");
  d.close();
});

test("取消运行中的任务阻止候选落库；持久化异常整体回滚", async () => {
  const d = db();
  const input = {
    url: "https://cdn.example.com/cancel.mp4",
    template: "tutorial",
    style: "auto",
    transcript: "有效字幕内容至少十个字符",
  };
  const j = enqueueVideoJob(d, input);
  const deps = {
    collect: async () => ({
      text: input.transcript,
      method: "provided",
      title: "标题",
      url: input.url,
    }),
    generate: async () => {
      cancelVideoJob(d, j.id);
      return { title: "候选", description: "", content: "正文" };
    },
    persist: () => assert.fail("取消后不能保存"),
  };
  await runVideoJob(d, deps);
  assert.equal(listVideoJobs(d)[0].status, "cancelled");
  enqueueVideoJob(d, { ...input, url: "https://cdn.example.com/rollback.mp4" });
  await runVideoJob(d, {
    ...deps,
    generate: async () => ({ title: "候选", description: "", content: "正文" }),
    persist: (post) => {
      d.prepare("INSERT INTO drafts VALUES(?,?,?)").run(post.slug, 0, "");
      throw Error("persist failed");
    },
  });
  assert.equal(d.prepare("SELECT COUNT(*) n FROM drafts").get().n, 0);
  assert.equal(
    listVideoJobs(d).find((x) => x.url.includes("rollback")).status,
    "failed",
  );
  d.close();
});

test("保留纯数字与路径，字幕清理不删除技术参数", () => {
  assert.match(
    transcriptText("版本参数如下：\n22\n路径 <project>/src\n具体操作请核对。"),
    /\n22\n/,
  );
  assert.match(
    transcriptText("这里使用路径 &lt;project&gt;/src 进行部署。"),
    /<project>/,
  );
});

test("拒绝 HTML 验证页和非字幕 JSON，避免生成虚假摘要", () => {
  for (const raw of [
    "<!doctype html><html>请登录查看视频</html>",
    JSON.stringify({ error: "access denied" }),
    JSON.stringify(null),
  ])
    assert.throws(() => transcriptText(raw), NeedsTranscript);
});

test("DNS 私网解析和重定向逐跳拒绝，响应体有上限", async () => {
  const { EventEmitter } = await import("node:events");
  const { Readable } = await import("node:stream");
  await assert.rejects(
    publicRequest(
      "https://cdn.example.com/a.mp4",
      {},
      {
        lookup: async () => [{ address: "10.0.0.1", family: 4 }],
        request: () => assert.fail("不应连接内网"),
      },
    ),
    /非公网/,
  );
  const fake = (status, headers, data) => ({
    lookup: async () => [{ address: "8.8.8.8", family: 4 }],
    request: (_url, _opts, callback) => {
      const req = new EventEmitter();
      req.end = () => {
        const res = Readable.from([Buffer.from(data)]);
        res.statusCode = status;
        res.headers = headers;
        callback(res);
        res.on("end", () => req.emit("close"));
      };
      req.destroy = (e) => {
        req.emit("error", e);
        req.emit("close");
      };
      return req;
    },
  });
  await assert.rejects(
    publicRequest(
      "https://cdn.example.com/a.mp4",
      {},
      fake(302, { location: "https://127.0.0.1/a.mp4" }, ""),
    ),
    /公网/,
  );
  await assert.rejects(
    publicRequest(
      "https://cdn.example.com/a.mp4",
      { maxBytes: 3 },
      fake(200, {}, "123456"),
    ),
    /大小/,
  );
  await assert.rejects(
    publicRequest(
      "https://cdn.example.com/a.mp4",
      { headers: { Authorization: "Bearer FAKE" } },
      fake(302, { location: "https://other.example.com/" }, ""),
    ),
    /重定向/,
  );
});

test("超过十分钟仍自动获取字幕；无字幕时禁止长视频音频下载", async () => {
  let downloads = 0;
  const metadata = {
    title: "长视频",
    duration: 3600,
    subtitles: {
      zh: [{ ext: "json3", url: "https://cdn.example.com/captions.json" }],
    },
  };
  const result = await collectVideo(
    { url: "https://www.youtube.com/watch?v=21J0ESU76KY" },
    {
      tool: async () => JSON.stringify(metadata),
      fetcher: async () => {
        downloads++;
        return {
          body: Buffer.from(
            JSON.stringify({
              events: [
                {
                  segs: [
                    { utf8: "这是一段长视频的自动字幕内容，用于整理文章。" },
                  ],
                },
              ],
            }),
          ),
        };
      },
      allowTranscription: true,
      transcribe: async () => assert.fail("有字幕不调用付费转写"),
    },
  );
  assert.equal(result.method, "subtitles");
  assert.equal(downloads, 1);
  await assert.rejects(
    collectVideo(
      { url: "https://youtu.be/21J0ESU76KY" },
      {
        tool: async (_cmd, args) => {
          assert.ok(args.includes("--dump-single-json"));
          return JSON.stringify({ title: "长视频无字幕", duration: 3600 });
        },
        allowTranscription: true,
        transcribe: async () => assert.fail("长音频不转写"),
      },
    ),
    /10 分钟/,
  );
});
