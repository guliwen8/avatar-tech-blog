import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  migrateFiles,
  uploadPrivateFile,
  bindPostFiles,
  fileReadable,
  parseRange,
  deletePrivateFile,
} from "../src/server/private-files.ts";
function fixture() {
  const db = new Database(":memory:");
  db.exec(
    "CREATE TABLE posts(slug TEXT PRIMARY KEY,published INTEGER,details TEXT); CREATE TABLE consultations(id TEXT PRIMARY KEY,member_id TEXT,status TEXT,updated_at INTEGER); INSERT INTO consultations VALUES('ticket-a','reader-a','open',0);",
  );
  migrateFiles(db);
  migrateFiles(db);
  return db;
}
const png = Buffer.from("89504e470d0a1a0a0000000000000000", "hex");
const stream = (bytes) =>
  new ReadableStream({
    start(c) {
      c.enqueue(bytes);
      c.close();
    },
  });
test("单段 Range 含后缀、越界与无效输入；拒绝多段", () => {
  assert.deepEqual(parseRange("bytes=1-3", 8), { start: 1, end: 3 });
  assert.deepEqual(parseRange("bytes=-3", 8), { start: 5, end: 7 });
  assert.deepEqual(parseRange("bytes=6-", 8), { start: 6, end: 7 });
  assert.deepEqual(parseRange("bytes=0-99", 8), { start: 0, end: 7 });
  for (const h of [
    "bytes=8-",
    "bytes=4-2",
    "bytes=0-1,3-4",
    "items=1-2",
    "bytes=-0",
  ])
    assert.throws(() => parseRange(h, 8));
});
test("截图只对咨询本人和管理员开放；伪造类型、路径名及关闭咨询不能上传", async () => {
  const db = fixture(),
    dir = await mkdtemp(path.join(tmpdir(), "avatar-file-"));
  try {
    const file = await uploadPrivateFile(db, dir, {
      name: "截图.png",
      purpose: "ticket",
      ticketId: "ticket-a",
      actor: { admin: false, memberId: "reader-a" },
      body: stream(png),
      contentLength: png.length,
    });
    assert.equal(
      fileReadable(
        db,
        file,
        { admin: false, memberId: "reader-a" },
        Date.now(),
      ),
      true,
    );
    assert.equal(
      fileReadable(
        db,
        file,
        { admin: false, memberId: "reader-b" },
        Date.now(),
      ),
      false,
    );
    assert.equal(fileReadable(db, file, { admin: false }, Date.now()), false);
    assert.equal(fileReadable(db, file, { admin: true }, Date.now()), true);
    assert.deepEqual(await readFile(path.join(dir, file.id)), png);
    for (const name of ["../../a.png", "x.svg", "x.html"])
      await assert.rejects(() =>
        uploadPrivateFile(db, dir, {
          name,
          purpose: "ticket",
          ticketId: "ticket-a",
          actor: { admin: false, memberId: "reader-a" },
          body: stream(png),
        }),
      );
    await assert.rejects(() =>
      uploadPrivateFile(db, dir, {
        name: "fake.png",
        purpose: "ticket",
        ticketId: "ticket-a",
        actor: { admin: false, memberId: "reader-a" },
        body: stream(Buffer.from("<html>bad</html>")),
      }),
    );
    db.prepare(
      "UPDATE consultations SET status='closed' WHERE id='ticket-a'",
    ).run();
    await assert.rejects(() =>
      uploadPrivateFile(db, dir, {
        name: "x.png",
        purpose: "ticket",
        ticketId: "ticket-a",
        actor: { admin: false, memberId: "reader-a" },
        body: stream(png),
      }),
    );
    assert.equal(db.prepare("SELECT count(*) n FROM private_files").get().n, 1);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("文章文件受文章权限控制，草稿/未绑定不可公开访问，不能被另一篇文章复用", async () => {
  const db = fixture(),
    dir = await mkdtemp(path.join(tmpdir(), "avatar-file-"));
  try {
    const bytes = Buffer.from("%PDF-1.7\ntest"),
      f = await uploadPrivateFile(db, dir, {
        name: "guide.pdf",
        purpose: "post",
        actor: { admin: true },
        body: stream(bytes),
      }),
      url = "/api/files/" + f.id;
    assert.equal(fileReadable(db, f, { admin: false }, 1000), false);
    db.prepare("INSERT INTO posts VALUES(?,?,?)").run(
      "one",
      1,
      JSON.stringify({ kind: "resource", access: "member", downloadUrl: url }),
    );
    bindPostFiles(db, "one", { downloadUrl: url });
    const bound = db
      .prepare("SELECT * FROM private_files WHERE id=?")
      .get(f.id);
    assert.equal(fileReadable(db, bound, { admin: false }, 1000), false);
    assert.equal(
      fileReadable(
        db,
        bound,
        { admin: false, memberId: "a", memberUntil: 1001 },
        1000,
      ),
      true,
    );
    assert.equal(
      fileReadable(
        db,
        bound,
        { admin: false, memberId: "a", memberUntil: 1000 },
        1000,
      ),
      false,
    );
    assert.throws(() => bindPostFiles(db, "two", { downloadUrl: url }));
    await assert.rejects(() =>
      deletePrivateFile(db, dir, f.id, { admin: true }),
    );
    db.prepare("UPDATE posts SET published=0").run();
    assert.equal(
      fileReadable(
        db,
        bound,
        { admin: false, memberId: "a", memberUntil: 1001 },
        1000,
      ),
      false,
    );
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
test("超限与中断会清理部分文件和预留记录", async () => {
  const db = fixture(),
    dir = await mkdtemp(path.join(tmpdir(), "avatar-file-"));
  try {
    await assert.rejects(() =>
      uploadPrivateFile(db, dir, {
        name: "x.png",
        purpose: "ticket",
        ticketId: "ticket-a",
        actor: { admin: false, memberId: "reader-a" },
        body: stream(Buffer.concat([png, Buffer.alloc(100)])),
        maxBytes: 30,
      }),
    );
    const broken = new ReadableStream({
      start(c) {
        c.enqueue(png);
        c.error(new Error("cancelled"));
      },
    });
    await assert.rejects(() =>
      uploadPrivateFile(db, dir, {
        name: "x.png",
        purpose: "ticket",
        ticketId: "ticket-a",
        actor: { admin: false, memberId: "reader-a" },
        body: broken,
      }),
    );
    assert.equal(db.prepare("SELECT count(*) n FROM private_files").get().n, 0);
    assert.deepEqual(await readdir(dir), []);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});

test("每条咨询最多九张；不能将咨询附件发布成文章下载，声明长度不符会清理", async () => {
  const db = fixture(),
    dir = await mkdtemp(path.join(tmpdir(), "avatar-file-"));
  const options = {
    name: "x.png",
    purpose: "ticket",
    ticketId: "ticket-a",
    actor: { admin: false, memberId: "reader-a" },
  };
  try {
    let first;
    for (let i = 0; i < 9; i++) {
      const f = await uploadPrivateFile(db, dir, {
        ...options,
        body: stream(png),
      });
      first ??= f;
    }
    await assert.rejects(() =>
      uploadPrivateFile(db, dir, { ...options, body: stream(png) }),
    );
    assert.throws(() =>
      bindPostFiles(db, "bad", { downloadUrl: "/api/files/" + first.id }),
    );
    await assert.rejects(() =>
      deletePrivateFile(db, dir, first.id, {
        admin: false,
        memberId: "reader-b",
      }),
    );
    await deletePrivateFile(db, dir, first.id, {
      admin: false,
      memberId: "reader-a",
    });
    await assert.rejects(() =>
      uploadPrivateFile(db, dir, {
        ...options,
        contentLength: 1,
        body: stream(png),
      }),
    );
    assert.equal(db.prepare("SELECT count(*) n FROM private_files").get().n, 8);
    assert.equal((await readdir(dir)).length, 8);
  } finally {
    db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
