import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { EventEmitter } from "node:events";
import { migrateEditorial } from "../src/server/editorial-migration.ts";
import {
  getAIConfig,
  saveAIConfig,
  publicAIConfig,
  providerUrl,
  isPublicAddress,
  requestEditorialAI,
} from "../src/server/editorial-ai.ts";
test("编辑素材迁移可重复，旧正文与计数不变；配置密钥不会出现在展示对象中", () => {
  const db = new Database(":memory:");
  db.exec(
    "CREATE TABLE posts(slug TEXT,content TEXT,views INTEGER);INSERT INTO posts VALUES('old','正文',42)",
  );
  migrateEditorial(db);
  migrateEditorial(db);
  assert.deepEqual(db.prepare("SELECT * FROM posts").get(), {
    slug: "old",
    content: "正文",
    views: 42,
    editorial: "{}",
  });
  assert.equal(getAIConfig(db).enabled, false);
  const shown = saveAIConfig(db, {
    baseUrl: "https://api.example.com/v1",
    model: "supplied-model",
    apiKey: "fake-test-secret",
    enabled: true,
  });
  assert.equal(shown.hasKey, true);
  assert.equal(JSON.stringify(shown).includes("fake-test-secret"), false);
  assert.equal(
    JSON.stringify(publicAIConfig(getAIConfig(db))).includes(
      "fake-test-secret",
    ),
    false,
  );
  assert.throws(() =>
    saveAIConfig(db, {
      baseUrl: "https://other.example.com/v1",
      model: "x",
      enabled: true,
    }),
  );
  saveAIConfig(db, {
    baseUrl: "https://api.example.com/v1",
    model: "x",
    clearKey: true,
    enabled: false,
  });
  assert.equal(getAIConfig(db).apiKey, "");
  db.close();
});
test("AI 只允许公网 HTTPS，拒绝私有、环回、映射及保留地址", () => {
  for (const url of [
    "http://api.example.com",
    "https://127.0.0.1/v1",
    "https://u:p@api.example.com",
    "https://api.example.com?key=x",
    "https://localhost/v1",
  ])
    assert.throws(() => providerUrl(url));
  for (const ip of [
    "127.0.0.1",
    "10.0.0.1",
    "100.64.1.2",
    "192.168.1.1",
    "169.254.169.254",
    "::1",
    "fc00::1",
    "::ffff:127.0.0.1",
    "fe80::1",
    "2001:db8::1",
  ])
    assert.equal(isPublicAddress(ip, ip.includes(":") ? 6 : 4), false, ip);
  assert.equal(isPublicAddress("8.8.8.8", 4), true);
});
test("服务端兼容请求的输出解析、截断及私网 DNS 拒绝（模拟传输，不调用付费模型）", async () => {
  const config = {
    baseUrl: "https://api.example.com/v1",
    model: "model",
    apiKey: "test-secret",
    enabled: true,
  };
  let payload;
  const deps = {
    lookup: async () => [{ address: "8.8.8.8", family: 4 }],
    request: (url, options, onResponse) => {
      assert.equal(url.pathname, "/v1/chat/completions");
      assert.equal(options.headers.Authorization, "Bearer test-secret");
      const req = new EventEmitter();
      req.destroy = (e) => {
        req.emit("error", e);
        req.emit("close");
      };
      req.end = (body) => {
        payload = JSON.parse(body);
        queueMicrotask(() => {
          const res = new EventEmitter();
          res.statusCode = 200;
          onResponse(res);
          res.emit(
            "data",
            Buffer.from(
              JSON.stringify({
                choices: [
                  {
                    finish_reason: "stop",
                    message: { content: '{"title":"草稿"}' },
                  },
                ],
              }),
            ),
          );
          res.emit("end");
          req.emit("close");
        });
      };
      return req;
    },
  };
  assert.match(
    await requestEditorialAI(
      config,
      [{ role: "user", content: "source" }],
      undefined,
      deps,
    ),
    /草稿/,
  );
  assert.equal(payload.max_completion_tokens, 4096);
  assert.equal(payload.store, false);
  await requestEditorialAI(
    { ...config, model: "MiniMax-M2.7" },
    [{ role: "user", content: "source" }],
    undefined,
    deps,
  );
  assert.equal(payload.max_completion_tokens, 16384);
  assert.equal(payload.reasoning_split, true);

  await assert.rejects(
    () =>
      requestEditorialAI(config, [], undefined, {
        ...deps,
        lookup: async () => [{ address: "127.0.0.1", family: 4 }],
      }),
    /非公网/,
  );
});

test("截断、服务错误、无效 JSON 与取消请求都拒绝，不返回服务商原始报错内容", async () => {
  const config = {
    baseUrl: "https://api.example.com/v1",
    model: "model",
    apiKey: "test-secret",
    enabled: true,
  };
  function deps(status, body) {
    return {
      lookup: async () => [{ address: "8.8.8.8", family: 4 }],
      request: (url, options, onResponse) => {
        options.lookup("api.example.com", { all: true }, (err, list) =>
          assert.deepEqual(list, [{ address: "8.8.8.8", family: 4 }]),
        );
        const req = new EventEmitter();
        req.destroy = (e) => {
          req.emit("error", e);
          req.emit("close");
        };
        req.end = () =>
          queueMicrotask(() => {
            const res = new EventEmitter();
            res.statusCode = status;
            onResponse(res);
            res.emit("data", Buffer.from(body));
            res.emit("end");
            req.emit("close");
          });
        return req;
      },
    };
  }
  await assert.rejects(
    () =>
      requestEditorialAI(
        config,
        [],
        undefined,
        deps(
          200,
          JSON.stringify({
            choices: [
              { finish_reason: "length", message: { content: "partial" } },
            ],
          }),
        ),
      ),
    /上限.*原始素材保留/,
  );
  await assert.rejects(
    () =>
      requestEditorialAI(
        config,
        [],
        undefined,
        deps(500, "sensitive-provider-response"),
      ),
    (e) =>
      /HTTP 500/.test(e.message) &&
      !e.message.includes("sensitive-provider-response"),
  );
  await assert.rejects(() =>
    requestEditorialAI(config, [], undefined, deps(200, "not-json")),
  );
  const ac = new AbortController();
  ac.abort();
  await assert.rejects(
    () => requestEditorialAI(config, [], ac.signal, deps(200, "{}")),
    /取消/,
  );
});
