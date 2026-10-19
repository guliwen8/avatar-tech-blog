import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/guard";
import { sameOrigin, fail } from "@/server/member-session";
import { getDB } from "@/server/db";
import { listAllTickets, getTicket, replyTicket } from "@/server/community";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const id = req.nextUrl.searchParams.get("id");
  const data = id ? getTicket(getDB(), id) : listAllTickets(getDB());
  return data
    ? NextResponse.json(data, {
        headers: { "Cache-Control": "private, no-store" },
      })
    : NextResponse.json({ error: "咨询不存在" }, { status: 404 });
}
export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const origin = sameOrigin(req);
  if (origin) return origin;
  try {
    const b = await req.json(),
      db = getDB();
    if (typeof b.id !== "string" || !getTicket(db, b.id))
      return NextResponse.json({ error: "咨询不存在" }, { status: 404 });
    if (b.action === "reply") replyTicket(db, b.id, "admin", null, b.body);
    else if (b.action === "close" || b.action === "reopen")
      db.prepare(
        "UPDATE consultations SET status=?,updated_at=? WHERE id=?",
      ).run(b.action === "close" ? "closed" : "open", Date.now(), b.id);
    else throw new Error("未知操作");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
