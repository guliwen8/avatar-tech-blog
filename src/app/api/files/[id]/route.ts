import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import { stat } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { Readable } from "node:stream";
import { getDB } from "@/server/db";
import { fileActor, privateFileRoot } from "@/server/file-runtime";
import { sameOrigin } from "@/server/member-session";
import {
  getPrivateFile,
  fileReadable,
  fileCacheScope,
  parseRange,
  deletePrivateFile,
  FileError,
  fileIdFromUrl,
} from "@/server/private-files";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
async function serve(req: NextRequest, { params }: Context, head = false) {
  const { id } = await params;
  const notFound = () =>
    new NextResponse(null, {
      status: 404,
      headers: { "Cache-Control": "private, no-store" },
    });
  if (!fileIdFromUrl("/api/files/" + id)) return notFound();
  const db = getDB(),
    file = getPrivateFile(db, id),
    actor = await fileActor();
  if (!file || !fileReadable(db, file, actor)) return notFound();
  const disk = path.join(privateFileRoot(), file.id);
  try {
    const info = await stat(disk);
    if (!info.isFile() || info.size !== file.size) return notFound();
  } catch {
    return notFound();
  }
  const header = req.headers.get("range");
  let start = 0,
    end = file.size - 1;
  if (header)
    try {
      ({ start, end } = parseRange(header, file.size));
    } catch {
      return new NextResponse(null, {
        status: 416,
        headers: {
          "Content-Range": `bytes */${file.size}`,
          "Cache-Control": "private, no-store",
        },
      });
    }
  const encoded = encodeURIComponent(file.name).replace(
    /['()*]/g,
    (c) => "%" + c.charCodeAt(0).toString(16).toUpperCase(),
  );
  const inline =
    file.mime.startsWith("video/") || file.mime.startsWith("image/");
  // 公开配图：UUID 文件名、内容写入后不再修改，因此可以 immutable 长缓存；
  // 其余（草稿、会员专属、工单附件）保持 private, no-store。
  const scope = fileCacheScope(db, file);
  const headers: Record<string, string> = {
    "Content-Type": file.mime,
    "Content-Length": String(end - start + 1),
    "Accept-Ranges": "bytes",
    "Cache-Control":
      scope === "public"
        ? "public, max-age=31536000, immutable"
        : "private, no-store",
    Vary: scope === "public" ? "Accept-Encoding" : "Cookie",
    "X-Content-Type-Options": "nosniff",
    "Cross-Origin-Resource-Policy": "same-origin",
    "Content-Security-Policy": "default-src 'none'; sandbox",
    "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="download"; filename*=UTF-8''${encoded}`,
  };
  if (scope === "public") {
    headers.ETag = `"${file.id}"`;
    headers["Last-Modified"] = new Date(file.created_at).toUTCString();
  }
  if (header) headers["Content-Range"] = `bytes ${start}-${end}/${file.size}`;
  return new NextResponse(
    head
      ? null
      : (Readable.toWeb(
          createReadStream(disk, { start, end }),
        ) as unknown as ReadableStream<Uint8Array>),
    { status: header ? 206 : 200, headers },
  );
}
export async function GET(req: NextRequest, ctx: Context) {
  return serve(req, ctx);
}
export async function HEAD(req: NextRequest, ctx: Context) {
  return serve(req, ctx, true);
}
export async function DELETE(req: NextRequest, { params }: Context) {
  const origin = sameOrigin(req);
  if (origin) return origin;
  const actor = await fileActor();
  if (!actor.admin && !actor.memberId)
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { id } = await params;
  if (!fileIdFromUrl("/api/files/" + id))
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  try {
    await deletePrivateFile(getDB(), privateFileRoot(), id, actor);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof FileError ? e.message : "删除失败，请重试" },
      { status: e instanceof FileError ? e.status : 400 },
    );
  }
}
