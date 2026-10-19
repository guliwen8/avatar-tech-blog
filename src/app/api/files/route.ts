import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/server/db";
import { sameOrigin } from "@/server/member-session";
import { fileActor, fileInfo, privateFileRoot } from "@/server/file-runtime";
import {
  uploadPrivateFile,
  FileError,
  type PrivateFile,
} from "@/server/private-files";
import { rateLimit } from "@/server/community";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const actor = await fileActor(),
    db = getDB(),
    id = req.nextUrl.searchParams.get("ticketId");
  if (id) {
    const ticket = db
      .prepare("SELECT member_id FROM consultations WHERE id=?")
      .get(id) as { member_id: string } | undefined;
    if (!ticket || (!actor.admin && ticket.member_id !== actor.memberId))
      return NextResponse.json({ error: "咨询不存在" }, { status: 404 });
    return NextResponse.json(
      (
        db
          .prepare(
            "SELECT * FROM private_files WHERE ticket_id=? AND status='ready' ORDER BY created_at",
          )
          .all(id) as PrivateFile[]
      ).map(fileInfo),
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
  if (!actor.admin)
    return NextResponse.json({ error: "请使用管理员账号" }, { status: 401 });
  return NextResponse.json(
    (
      db
        .prepare(
          "SELECT * FROM private_files ORDER BY created_at DESC LIMIT 100",
        )
        .all() as PrivateFile[]
    ).map(fileInfo),
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function POST(req: NextRequest) {
  const origin = sameOrigin(req);
  if (origin) return origin;
  const actor = await fileActor();
  if (!actor.admin && !actor.memberId)
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const purpose = req.nextUrl.searchParams.get("purpose");
  if (purpose !== "post" && purpose !== "ticket")
    return NextResponse.json({ error: "上传用途无效" }, { status: 400 });
  if (purpose === "post" && !actor.admin)
    return NextResponse.json({ error: "请使用管理员账号" }, { status: 403 });
  if (!req.body)
    return NextResponse.json({ error: "请选择文件" }, { status: 400 });
  const db = getDB();
  if (
    !rateLimit(
      db,
      "upload:" + (actor.admin ? "admin" : actor.memberId),
      actor.admin ? 100 : 20,
      900000,
    )
  )
    return NextResponse.json(
      { error: "上传过于频繁，请稍后重试" },
      { status: 429 },
    );
  try {
    const length = req.headers.get("content-length");
    const file = await uploadPrivateFile(db, privateFileRoot(), {
      name: req.nextUrl.searchParams.get("name") || "",
      purpose,
      ticketId: req.nextUrl.searchParams.get("ticketId") || undefined,
      actor,
      body: req.body,
      contentLength: length === null ? undefined : Number(length),
    });
    return NextResponse.json(
      { ok: true, file: fileInfo(file) },
      { status: 201 },
    );
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof FileError ? e.message : "上传未完成，请重试" },
      { status: e instanceof FileError ? e.status : 400 },
    );
  }
}
