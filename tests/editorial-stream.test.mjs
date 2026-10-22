import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { requestEditorialAI } from "../src/server/editorial-ai.ts";
import { editorialStream } from "../src/server/editorial-stream.ts";
import { readEditorialResponse } from "../src/lib/editorial-response.ts";
const config = {
  baseUrl: "https://api.example.com/v1",
  model: "MiniMax-M2.7",
  apiKey: "fake",
  enabled: true,
};
test("超过90秒仍等待，5分钟硬超时且只请求一次", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let requests = 0,
    req;
  const pending = requestEditorialAI(config, [], undefined, {
    lookup: async () => [{ address: "8.8.8.8", family: 4 }],
    request: () => {
      requests++;
      req = new EventEmitter();
      req.end = () => {};
      req.destroy = (e) => {
        req.emit("error", e);
        req.emit("close");
      };
      return req;
    },
  });
  await Promise.resolve();
  await Promise.resolve();
  let finished = false;
  pending.then(
    () => (finished = true),
    () => (finished = true),
  );
  t.mock.timers.tick(90001);
  await Promise.resolve();
  assert.equal(finished, false);
  const rejected = assert.rejects(pending, /5 分钟/);
  t.mock.timers.tick(210000);
  await rejected;
  assert.equal(requests, 1);
});
test("等待期间有心跳，最终完整候选被解析，失败不会当成成功", async () => {
  let finish;
  const result = new Promise((r) => (finish = r));
  const stream = editorialStream(() => result, undefined, 5);
  const reader = stream.getReader();
  const first = await reader.read();
  assert.match(new TextDecoder().decode(first.value), /progress/);
  const heartbeat = await reader.read();
  assert.match(new TextDecoder().decode(heartbeat.value), /progress/);
  finish({ title: "完整草稿", content: "## 正文\n资料", description: "" });
  let chunks = [first.value, heartbeat.value];
  for (;;) {
    const x = await reader.read();
    if (x.done) break;
    chunks.push(x.value);
  }
  const response = new Response(
    new ReadableStream({
      start(c) {
        for (const chunk of chunks)
          for (let i = 0; i < chunk.length; i += 3)
            c.enqueue(chunk.subarray(i, i + 3));
        c.close();
      },
    }),
    { headers: { "Content-Type": "application/x-ndjson" } },
  );
  assert.equal((await readEditorialResponse(response)).title, "完整草稿");
  await assert.rejects(
    () =>
      readEditorialResponse(
        new Response(
          editorialStream(async () => {
            throw Error("AI 超时");
          }),
          { headers: { "Content-Type": "application/x-ndjson" } },
        ),
      ),
    /AI 超时/,
  );
});
test("断流不采用残缺稿；兼容原JSON接口，取消等待传递给生成请求", async () => {
  await assert.rejects(
    () =>
      readEditorialResponse(
        new Response('{"type":"progress"}\n', {
          headers: { "Content-Type": "application/x-ndjson" },
        }),
      ),
    /中断/,
  );
  assert.equal(
    (
      await readEditorialResponse(
        new Response('{"title":"旧格式"}', {
          headers: { "Content-Type": "application/json" },
        }),
      )
    ).title,
    "旧格式",
  );
  let received;
  const stream = editorialStream(
    (signal) =>
      new Promise((resolve, reject) => {
        received = signal;
        signal.addEventListener("abort", () => reject(Error("请求已取消")), {
          once: true,
        });
      }),
  );
  const reader = stream.getReader();
  await reader.read();
  await reader.cancel();
  assert.equal(received.aborted, true);
});
