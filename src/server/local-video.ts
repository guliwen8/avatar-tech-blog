import type Database from "better-sqlite3";
import crypto from "node:crypto";
import path from "node:path";
import { mkdir, unlink, open } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
export const LOCAL_VIDEO_ID = /^local-video:([a-f0-9-]{36})$/;
export function localVideoRoot() {
  return path.join(
    path.dirname(
      process.env.DB_PATH || path.join(process.cwd(), "data/blog.db"),
    ),
    "video-imports",
  );
}
export function migrateLocalVideos(db: Database.Database) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS video_import_files(id TEXT PRIMARY KEY,name TEXT NOT NULL,size INTEGER NOT NULL,created_at INTEGER NOT NULL,ready INTEGER NOT NULL DEFAULT 0)",
  );
}
export function localVideoInfo(db: Database.Database, url: string) {
  const id = LOCAL_VIDEO_ID.exec(url)?.[1];
  if (!id) throw Error("本地视频标识无效");
  const r = db
    .prepare("SELECT * FROM video_import_files WHERE id=? AND ready=1")
    .get(id) as { id: string; name: string; size: number } | undefined;
  if (!r) throw Error("本地视频已删除，请重新选择文件");
  return r;
}
export async function cleanLocalVideos(db: Database.Database, root: string) {
  const rows = db
    .prepare("SELECT id FROM video_import_files WHERE created_at<?")
    .all(Date.now() - 7 * 86400000) as { id: string }[];
  for (const r of rows) {
    if (
      db
        .prepare(
          "SELECT id FROM video_import_jobs WHERE url=? AND status IN ('queued','running')",
        )
        .get("local-video:" + r.id)
    )
      continue;
    await unlink(path.join(root, r.id)).catch(() => {});
    db.prepare("DELETE FROM video_import_files WHERE id=?").run(r.id);
  }
}
export async function saveLocalVideo(
  db: Database.Database,
  root: string,
  name: string,
  body: ReadableStream<Uint8Array>,
  length?: number,
) {
  if (!/\.(mp4|webm)$/i.test(name)) throw Error("请选择 MP4 或 WebM 视频");
  const max = 80 * 1024 * 1024;
  if (
    length !== undefined &&
    (!Number.isFinite(length) || length <= 0 || length > max)
  )
    throw Error("视频文件必须大于 0 且不超过 80 MB");
  await mkdir(root, { recursive: true, mode: 0o700 });
  await cleanLocalVideos(db, root);
  const id = crypto.randomUUID();
  db.transaction(() => {
    const r = db
      .prepare("SELECT COALESCE(SUM(size),0) n FROM video_import_files")
      .get() as { n: number };
    if (r.n + max > 800 * 1024 * 1024)
      throw Error("本地视频素材空间已满，请删除旧源文件");
    db.prepare(
      "INSERT INTO video_import_files(id,name,size,created_at) VALUES(?,?,?,?)",
    ).run(id, path.basename(name).slice(0, 200), max, Date.now());
  }).immediate();
  const target = path.join(root, id);
  let size = 0;
  try {
    const limiter = new Transform({
      transform(chunk, _e, cb) {
        size += chunk.length;
        cb(size > max ? Error("视频不能超过 80 MB") : null, chunk);
      },
    });
    await pipeline(
      Readable.fromWeb(body as any),
      limiter,
      createWriteStream(target, { flags: "wx", mode: 0o600 }),
    );
    const h = await open(target, "r");
    let magic = Buffer.alloc(12);
    try {
      await h.read(magic, 0, 12, 0);
    } finally {
      await h.close();
    }
    if (
      !size ||
      (/\.mp4$/i.test(name)
        ? magic.toString("ascii", 4, 8) !== "ftyp"
        : !magic.subarray(0, 4).equals(Buffer.from("1a45dfa3", "hex")))
    )
      throw Error("文件内容与视频格式不匹配");
    db.prepare("UPDATE video_import_files SET size=?,ready=1 WHERE id=?").run(
      size,
      id,
    );
    return {
      id,
      name: path.basename(name).slice(0, 200),
      size,
      url: "local-video:" + id,
    };
  } catch (e) {
    await unlink(target).catch(() => {});
    db.prepare("DELETE FROM video_import_files WHERE id=?").run(id);
    throw e;
  }
}
export async function removeLocalVideo(
  db: Database.Database,
  root: string,
  url: string,
) {
  const r = localVideoInfo(db, url);
  if (
    db
      .prepare(
        "SELECT id FROM video_import_jobs WHERE url=? AND status IN ('queued','running')",
      )
      .get(url)
  )
    throw Error("任务正在处理，取消后再删除源文件");
  await unlink(path.join(root, r.id)).catch((e) => {
    if (e.code !== "ENOENT") throw e;
  });
  db.prepare("DELETE FROM video_import_files WHERE id=?").run(r.id);
}
