import test from "node:test";
import assert from "node:assert/strict";
import { imageResultUrl } from "../src/server/image-response.ts";
test("区分认证、额度、限流、参数和审核错误，仅显示安全错误码，不泄漏原始服务报错", () => {
  for (const [code, match] of [
    [1004, /密钥/],
    [1008, /计费/],
    [1002, /限流/],
    [2013, /参数/],
    [2056, /订阅额度/],
    [1026, /内容/],
  ]) {
    assert.throws(
      () =>
        imageResultUrl({
          base_resp: {
            status_code: code,
            status_msg: "sk-secret-private-prompt",
          },
        }),
      (e) =>
        e.message.includes(String(code)) &&
        match.test(e.message) &&
        !e.message.includes("sk-secret"),
    );
  }
});
test("成功但缺少图片时提示格式，不能误报余额；有效返回兼容数字字符串状态码", () => {
  assert.equal(
    imageResultUrl({
      base_resp: { status_code: "0" },
      data: { image_urls: ["https://cdn.example/a.png"] },
    }),
    "https://cdn.example/a.png",
  );
  assert.throws(
    () =>
      imageResultUrl({
        base_resp: { status_code: 0 },
        data: { image_urls: [] },
      }),
    /返回成功.*未提供/,
  );
  assert.throws(
    () =>
      imageResultUrl({ data: { image_urls: ["https://cdn.example/a.png"] } }),
    /未提供状态码/,
  );
  assert.throws(
    () => imageResultUrl({ base_resp: { status_code: "secret-key" } }),
    (e) => !e.message.includes("secret-key"),
  );
});
