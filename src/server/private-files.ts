import type Database from "better-sqlite3";
import crypto from "node:crypto";
import path from "node:path";
import { mkdir, rename, unlink } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
export interface FileActor {
  admin: boolean;
  memberId?: string;
  memberUntil?: number;
}
export interface PrivateFile {
  id: string;
  purpose: "post" | "ticket" | "payment";
  name: string;
  mime: string;
  size: number;
  status: "pending" | "ready";
  ticket_id: string | null;
  post_slug: string | null;
  member_id: string | null;
  uploaded_by: "admin" | "member";
  created_at: number;
}
export class FileError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}
export function migrateFiles(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS private_files(id TEXT PRIMARY KEY,purpose TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL,status TEXT NOT NULL,ticket_id TEXT,post_slug TEXT,member_id TEXT,uploaded_by TEXT NOT NULL,created_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS private_files_ticket ON private_files(ticket_id);CREATE INDEX IF NOT EXISTS private_files_post ON private_files(post_slug);CREATE INDEX IF NOT EXISTS private_files_member ON private_files(member_id);`);
}
export function fileIdFromUrl(raw?: string): string | null {
  const match = raw?.match(
    /^\/api\/files\/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})$/,
  );
  return match?.[1] || null;
}
export function getPrivateFile(
  db: Database.Database,
  id: string,
): PrivateFile | null {
  return (
    (db
      .prepare("SELECT * FROM private_files WHERE id=?")
      .get(id) as PrivateFile) || null
  );
}
function ticketForUpload(
  db: Database.Database,
  id: string | undefined,
  actor: FileActor,
) {
  const t = db
    .prepare("SELECT * FROM consultations WHERE id=?")
    .get(id || "") as { member_id: string; status: string } | undefined;
  if (!t || (!actor.admin && t.member_id !== actor.memberId))
    throw new FileError("咨询不存在", 404);
  if (t.status === "closed")
    throw new FileError("咨询已关闭，不能添加附件", 409);
  return t;
}
function format(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  const types: Record<string, string> = {
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    webp: "image/webp",
    mp4: "video/mp4",
    webm: "video/webm",
    pdf: "application/pdf",
    zip: "application/zip",
    "7z": "application/x-7z-compressed",
  };
  return types[ext || ""] || null;
}
function signature(mime: string, buf: Buffer) {
  if (mime === "image/png")
    return buf.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"));
  if (mime === "image/jpeg")
    return buf.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"));
  if (mime === "image/webp")
    return (
      buf.toString("ascii", 0, 4) === "RIFF" &&
      buf.toString("ascii", 8, 12) === "WEBP"
    );
  if (mime === "video/mp4") return buf.toString("ascii", 4, 8) === "ftyp";
  if (mime === "video/webm")
    return buf.subarray(0, 4).equals(Buffer.from("1a45dfa3", "hex"));
  if (mime === "application/pdf")
    return buf.toString("ascii", 0, 5) === "%PDF-";
  if (mime === "application/zip")
    return ["504b0304", "504b0506", "504b0708"].some((v) =>
      buf.subarray(0, 4).equals(Buffer.from(v, "hex")),
    );
  return (
    mime === "application/x-7z-compressed" &&
    buf.subarray(0, 6).equals(Buffer.from("377abcaf271c", "hex"))
  );
}
async function removeDisk(root: string, id: string) {
  for (const suffix of ["", ".part"]) {
    try {
      await unlink(path.join(root, id + suffix));
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
    }
  }
}
export async function uploadPrivateFile(
  db: Database.Database,
  root: string,
  input: {
    name: string;
    purpose: "post" | "ticket" | "payment";
    ticketId?: string;
    actor: FileActor;
    body: ReadableStream<Uint8Array>;
    contentLength?: number;
    maxBytes?: number;
  },
) {
  const name = input.name.trim();
  if (!name || name.length > 180 || /[\/\\\x00-\x1f\x7f]/.test(name))
    throw new FileError("文件名无效");
  const mime = format(name);
  if (
    !mime ||
    ((input.purpose === "ticket" || input.purpose === "payment") &&
      !mime.startsWith("image/"))
  )
    throw new FileError("不支持此文件类型", 415);
  if (input.purpose !== "ticket" && !input.actor.admin)
    throw new FileError("请使用管理员账号上传", 403);
  const max =
    input.maxBytes ??
    (input.purpose === "ticket"
      ? 5 * 1024 * 1024
      : mime.startsWith("video/")
        ? 100 * 1024 * 1024
        : 50 * 1024 * 1024);
  if (
    input.contentLength !== undefined &&
    (!Number.isSafeInteger(input.contentLength) ||
      input.contentLength <= 0 ||
      input.contentLength > max)
  )
    throw new FileError("文件大小超过限制或为空", 413);
  const reserved = input.contentLength ?? max,
    id = crypto.randomUUID();
  const storageLimit =
    Math.max(100, Number(process.env.FILE_STORAGE_LIMIT_MB) || 2048) *
    1024 *
    1024;
  db.transaction(() => {
    const ticket =
      input.purpose === "ticket"
        ? ticketForUpload(db, input.ticketId, input.actor)
        : null;
    if (ticket) {
      const count = db
        .prepare("SELECT count(*) n FROM private_files WHERE ticket_id=?")
        .get(input.ticketId) as { n: number };
      if (count.n >= 9) throw new FileError("每条咨询最多保存 9 张截图", 409);
      const used = db
        .prepare(
          "SELECT coalesce(sum(size),0) n FROM private_files WHERE member_id=?",
        )
        .get(ticket.member_id) as { n: number };
      if (used.n + reserved > 100 * 1024 * 1024)
        throw new FileError("此账号截图存储空间已满", 413);
    }
    const total = db
      .prepare("SELECT coalesce(sum(size),0) n FROM private_files")
      .get() as { n: number };
    if (total.n + reserved > storageLimit)
      throw new FileError("文件存储空间已满，请联系站长", 413);
    db.prepare(
      "INSERT INTO private_files(id,purpose,name,mime,size,status,ticket_id,member_id,uploaded_by,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)",
    ).run(
      id,
      input.purpose,
      name,
      mime,
      reserved,
      "pending",
      input.purpose === "ticket" ? input.ticketId : null,
      ticket?.member_id || null,
      input.actor.admin ? "admin" : "member",
      Date.now(),
    );
  }).immediate();
  let count = 0,
    head = Buffer.alloc(0);
  try {
    await mkdir(root, { recursive: true, mode: 0o700 });
    const limit = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        count += chunk.length;
        if (count > max)
          return callback(new FileError("文件大小超过限制", 413));
        if (head.length < 64)
          head = Buffer.concat([head, chunk.subarray(0, 64 - head.length)]);
        callback(null, chunk);
      },
    });
    await pipeline(
      Readable.fromWeb(input.body as any),
      limit,
      createWriteStream(path.join(root, id + ".part"), {
        flags: "wx",
        mode: 0o600,
      }),
    );
    if (input.contentLength !== undefined && count !== input.contentLength)
      throw new FileError("上传长度不一致，请重试", 400);
    if (!count || !signature(mime, head))
      throw new FileError("文件内容与扩展名不匹配", 415);
    await rename(path.join(root, id + ".part"), path.join(root, id));
    db.transaction(() => {
      if (input.purpose === "ticket")
        ticketForUpload(db, input.ticketId, input.actor);
      const result = db
        .prepare("UPDATE private_files SET status='ready',size=? WHERE id=?")
        .run(count, id);
      if (!result.changes) throw new FileError("上传记录已取消", 409);
      if (input.purpose === "ticket")
        db.prepare(
          "UPDATE consultations SET status=?,updated_at=? WHERE id=?",
        ).run(
          input.actor.admin ? "replied" : "open",
          Date.now(),
          input.ticketId,
        );
    }).immediate();
    return getPrivateFile(db, id)!;
  } catch (e) {
    await removeDisk(root, id);
    db.prepare("DELETE FROM private_files WHERE id=?").run(id);
    throw e;
  }
}
export function articleImageIds(article?: {
  cover?: string;
  content?: string;
}) {
  const ids = new Set<string>();
  const cover = fileIdFromUrl(article?.cover);
  if (cover) ids.add(cover);
  for (const match of (article?.content || "").matchAll(
    /!\[[^\]\n]*\]\(\/api\/files\/([a-f0-9-]{36})\)/g,
  ))
    if (fileIdFromUrl("/api/files/" + match[1])) ids.add(match[1]);
  return ids;
}
export function bindPostFiles(
  db: Database.Database,
  slug: string,
  details?: { videoUrl?: string; downloadUrl?: string },
  article?: { cover: string; content: string },
) {
  for (const id of articleImageIds(article)) {
    const f = getPrivateFile(db, id);
    if (
      !f ||
      f.status !== "ready" ||
      f.purpose !== "post" ||
      !f.mime.startsWith("image/")
    )
      throw new FileError("文章图片不存在或不是图片文件", 400);
    if (f.post_slug && f.post_slug !== slug)
      throw new FileError("图片已绑定另一篇文章，请上传副本", 409);
    db.prepare("UPDATE private_files SET post_slug=? WHERE id=?").run(slug, id);
  }
  for (const key of ["videoUrl", "downloadUrl"] as const) {
    const id = fileIdFromUrl(details?.[key]);
    if (!id) continue;
    const f = getPrivateFile(db, id);
    if (!f || f.status !== "ready" || f.purpose !== "post")
      throw new FileError("文章文件不存在或上传未完成", 400);
    if (key === "videoUrl" && !f.mime.startsWith("video/"))
      throw new FileError("播放地址必须使用视频文件", 400);
    if (f.post_slug && f.post_slug !== slug)
      throw new FileError("文件已绑定另一篇文章，请重新上传副本", 409);
    db.prepare("UPDATE private_files SET post_slug=? WHERE id=?").run(slug, id);
  }
}
export function fileReadable(
  db: Database.Database,
  file: PrivateFile,
  actor: FileActor,
  now = Date.now(),
): boolean {
  if (file.status !== "ready") return false;
  if (actor.admin) return true;
  // 收款码是给人扫码付款用的，必须公开可读
  if (file.purpose === "payment") return true;
  if (file.purpose === "ticket") {
    const t = db
      .prepare("SELECT member_id FROM consultations WHERE id=?")
      .get(file.ticket_id) as { member_id: string } | undefined;
    return !!actor.memberId && t?.member_id === actor.memberId;
  }
  if (!file.post_slug) return false;
  const p = db
    .prepare("SELECT * FROM posts WHERE slug=?")
    .get(file.post_slug) as
    | { published: number; details: string; cover?: string; content?: string }
    | undefined;
  if (!p?.published) return false;
  try {
    const d = JSON.parse(p.details || "{}"),
      url = "/api/files/" + file.id;
    if (file.mime.startsWith("image/") && p.cover === url) return true;
    if (
      d.videoUrl !== url &&
      d.downloadUrl !== url &&
      !(
        file.mime.startsWith("image/") &&
        articleImageIds({ content: p.content }).has(file.id)
      )
    )
      return false;
    const policy = d.access || "public";
    return (
      policy === "public" ||
      (!!actor.memberId &&
        (policy === "login" ||
          (policy === "member" && (actor.memberUntil || 0) > now)))
    );
  } catch {
    return false;
  }
}
/**
 * 判定一个文件能否被公开缓存。
 *
 * 只有「已发布文章的配图，且访问策略为 public」才允许公共缓存；
 * 会员专属内容、草稿、工单附件一律返回 private，避免共享缓存泄露。
 */
export function fileCacheScope(
  db: Database.Database,
  file: PrivateFile,
): "public" | "private" {
  // 收款码公开可读且内容不变，可长期缓存
  if (file.purpose === "payment" && file.mime.startsWith("image/"))
    return "public";
  if (file.purpose !== "post" || !file.mime.startsWith("image/"))
    return "private";
  if (!file.post_slug) return "private";
  const p = db
    .prepare("SELECT published,details,cover FROM posts WHERE slug=?")
    .get(file.post_slug) as
    | { published: number; details: string; cover?: string }
    | undefined;
  if (!p?.published) return "private";
  const url = "/api/files/" + file.id;
  // 封面在 fileReadable 中无条件放行，因此可公开缓存
  if (p.cover === url) return "public";
  try {
    const details = JSON.parse(p.details || "{}") as { access?: string };
    return (details.access || "public") === "public" ? "public" : "private";
  } catch {
    return "private";
  }
}
export async function deletePrivateFile(
  db: Database.Database,
  root: string,
  id: string,
  actor: FileActor,
) {
  const f = getPrivateFile(db, id);
  if (!f) throw new FileError("文件不存在", 404);
  if (!actor.admin) {
    if (f.purpose !== "ticket" || f.uploaded_by !== "member")
      throw new FileError("文件不存在", 404);
    ticketForUpload(db, f.ticket_id || undefined, actor);
  }
  if (f.purpose === "post" && f.post_slug) {
    const p = db
      .prepare("SELECT * FROM posts WHERE slug=?")
      .get(f.post_slug) as
      { details: string; cover?: string; content?: string } | undefined;
    if (p) {
      try {
        const d = JSON.parse(p.details || "{}");
        if (
          d.videoUrl === "/api/files/" + id ||
          d.downloadUrl === "/api/files/" + id ||
          articleImageIds(p).has(id)
        )
          throw new FileError("请先从文章中移除此文件链接", 409);
      } catch (e) {
        if (e instanceof FileError) throw e;
        throw new FileError("请先检查文章资料配置", 409);
      }
    }
  }
  await removeDisk(root, id);
  db.prepare("DELETE FROM private_files WHERE id=?").run(id);
}
export function parseRange(
  header: string,
  size: number,
): { start: number; end: number } {
  const m = /^bytes=(\d*)-(\d*)$/.exec(header);
  if (!m || !size || (!m[1] && !m[2]))
    throw new FileError("无效的分段请求", 416);
  let start: number, end: number;
  if (!m[1]) {
    const suffix = Number(m[2]);
    if (!Number.isSafeInteger(suffix) || suffix <= 0)
      throw new FileError("无效的分段请求", 416);
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] ? Math.min(Number(m[2]), size - 1) : size - 1;
  }
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start < 0 ||
    start >= size ||
    end < start
  )
    throw new FileError("无效的分段请求", 416);
  return { start, end };
}
