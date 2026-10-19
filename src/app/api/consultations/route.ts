import { NextRequest, NextResponse } from "next/server";
import { currentMember, sameOrigin, fail } from "@/server/member-session";
import { getDB } from "@/server/db";
import {
  getTicket,
  listMemberTickets,
  createTicket,
  replyTicket,
  rateLimit,
} from "@/server/community";
export const dynamic = "force-dynamic";
export async function GET(req: NextRequest) {
  const m = await currentMember();
  if (!m) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const id = req.nextUrl.searchParams.get("id");
  const data = id
    ? getTicket(getDB(), id, m.id)
    : listMemberTickets(getDB(), m.id);
  return data
    ? NextResponse.json(data, {
        headers: { "Cache-Control": "private, no-store" },
      })
    : NextResponse.json({ error: "咨询不存在" }, { status: 404 });
}
export async function POST(req: NextRequest) {
  const origin = sameOrigin(req);
  if (origin) return origin;
  const m = await currentMember();
  if (!m) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  try {
    const b = await req.json(),
      db = getDB();
    if (!rateLimit(db, "consult:" + m.id, 6, 60000))
      return NextResponse.json(
        { error: "提交过于频繁，请稍后重试" },
        { status: 429 },
      );
    if (b.action === "reply") {
      if (typeof b.id !== "string" || !getTicket(db, b.id, m.id))
        return NextResponse.json({ error: "咨询不存在" }, { status: 404 });
      replyTicket(db, b.id, "member", m.id, b.body);
      return NextResponse.json({ ok: true });
    }
    if (b.action !== "create") throw new Error("未知操作");
    const ticket = createTicket(db, m.id, b);
    return NextResponse.json({ ok: true, id: ticket.id });
  } catch (error) {
    return fail(error);
  }
}
