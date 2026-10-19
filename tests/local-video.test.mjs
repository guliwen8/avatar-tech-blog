import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  migrateLocalVideos,
  saveLocalVideo,
  localVideoInfo,
  removeLocalVideo,
} from "../src/server/local-video.ts";
import {
  migrateVideoJobs,
  enqueueVideoJob,
  runVideoJob,
} from "../src/server/video-jobs.ts";
const stream = (buf) =>
  new ReadableStream({
    start(c) {
      c.enqueue(buf);
      c.close();
    },
  });
test("本地上传限制、真实签名、私有路径、失败清理与运行删除保护", async () => {
  const db = new Database(":memory:");
  migrateLocalVideos(db);
  migrateVideoJobs(db);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "avatar-local-test-"));
  try {
    await assert.rejects(
      saveLocalVideo(db, root, "x.exe", stream(Buffer.from("bad"))),
      /MP4/,
    );
    await assert.rejects(
      saveLocalVideo(db, root, "x.mp4", stream(Buffer.from("not video"))),
      /格式/,
    );
    assert.equal(
      db.prepare("SELECT COUNT(*) n FROM video_import_files").get().n,
      0,
    );
    await assert.rejects(
      saveLocalVideo(
        db,
        root,
        "x.mp4",
        stream(Buffer.alloc(0)),
        81 * 1024 * 1024,
      ),
      /80 MB/,
    );
    const bytes = Buffer.concat([
      Buffer.from([0, 0, 0, 24]),
      Buffer.from("ftypisom0000"),
    ]);
    const file = await saveLocalVideo(
      db,
      root,
      "demo.mp4",
      stream(bytes),
      bytes.length,
    );
    assert.equal(localVideoInfo(db, file.url).name, "demo.mp4");
    assert.ok(
      ((await fs.stat(path.join(root, file.id))).mode & 0o777) === 0o600,
    );
    const job = enqueueVideoJob(db, {
      url: file.url,
      template: "tutorial",
      style: "auto",
      transcript: "测试字幕包含足够多的内容。",
    });
    await assert.rejects(removeLocalVideo(db, root, file.url), /正在处理/);
    let post;
    await runVideoJob(db, {
      collect: async () => ({
        text: "测试字幕包含足够多的内容。",
        title: "demo.mp4",
        url: file.url,
        method: "provided",
      }),
      generate: async () => ({
        title: "候选",
        description: "摘要",
        content: "候选正文",
      }),
      persist: (p) => {
        post = p;
        return p.slug;
      },
    });
    assert.equal(post.published, false);
    assert.equal(post.content, "");
    assert.match(post.editorial.sources, /本地上传/);
    assert.equal(post.editorial.sources.includes(file.id), false);
    await removeLocalVideo(db, root, file.url);
    assert.throws(() => localVideoInfo(db, file.url), /已删除/);
    assert.deepEqual(await fs.readdir(root), []);
  } finally {
    db.close();
    await fs.rm(root, { recursive: true, force: true });
  }
});
