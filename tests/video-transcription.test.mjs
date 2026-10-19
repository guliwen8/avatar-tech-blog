import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  collectVideo,
  runTool,
  NeedsTranscript,
} from "../src/server/video-source.mjs";
import { transcribeMiniMax } from "../src/server/video-asr.mjs";
test("MiniMax ASR 请求只发官方域名并保留错误，不跟随转写跳转", async () => {
  let seen = false;
  const text = await transcribeMiniMax(
    { baseUrl: "https://api.minimax.cn/v1", apiKey: "fake-key" },
    Buffer.from("audio"),
    undefined,
    async (url, options) => {
      seen = true;
      assert.equal(url, "https://api.minimax.cn/v1/speech_to_text");
      assert.equal(options.headers.Authorization, "Bearer fake-key");
      assert.equal(options.redirects, 0);
      assert.ok(options.body.includes(Buffer.from("asr-1.0")));
      assert.ok(!options.body.includes(Buffer.from("fake-key")));
      return { body: Buffer.from('{"text":"这是语音转写结果。"}') };
    },
  );
  assert.ok(seen);
  assert.match(text, /转写/);
  await assert.rejects(
    () =>
      transcribeMiniMax(
        { baseUrl: "https://other.example.com/v1", apiKey: "fake-key" },
        Buffer.from("x"),
      ),
    NeedsTranscript,
  );
});
test("MP4 经真实 ffprobe/ffmpeg 提取音频，转写调用使用模拟服务", async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "avatar-video-test-"));
  try {
    const media = path.join(dir, "sample.mp4");
    await runTool("ffmpeg", [
      "-nostdin",
      "-v",
      "error",
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=160x120:r=10:d=2",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:duration=2",
      "-shortest",
      "-c:v",
      "mpeg4",
      "-c:a",
      "aac",
      media,
    ]);
    let bytes = 0;
    const result = await collectVideo(
      { url: "https://cdn.example.com/sample.mp4" },
      {
        allowTranscription: true,
        fetcher: async (_url, { saveTo }) => {
          await fs.copyFile(media, saveTo);
          return { body: Buffer.alloc(0) };
        },
        transcribe: async (audio) => {
          bytes = audio.length;
          return "这是模拟语音服务返回的完整转写内容。";
        },
      },
    );
    assert.equal(result.method, "asr");
    assert.ok(bytes > 1000);
    assert.match(result.text, /转写/);
    const local = await collectVideo(
      { url: "local-video:00000000-0000-0000-0000-000000000000" },
      {
        localMedia: { path: media, name: "本地演示.mp4" },
        allowTranscription: true,
        fetcher: async () => assert.fail("本地视频不应联网下载"),
        transcribe: async (audio) => {
          assert.ok(audio.length > 1000);
          return "这是本地视频的模拟转写内容。";
        },
      },
    );
    assert.equal(local.title, "本地演示.mp4");
    assert.equal(local.method, "asr");
    await assert.rejects(
      collectVideo(
        { url: "local-video:00000000-0000-0000-0000-000000000000" },
        { localMedia: { path: media, name: "本地演示.mp4" } },
      ),
      NeedsTranscript,
    );
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
