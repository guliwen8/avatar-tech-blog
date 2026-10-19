import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/guard";
import { sameOrigin, fail } from "@/server/member-session";
import { getDB } from "@/server/db";
import {
  listMembers,
  grantMembership,
  setMemberPassword,
} from "@/server/community";
export const dynamic = "force-dynamic";
export async function GET() {
  const guard = await requireAuth();
  if (guard) return guard;
  return NextResponse.json(listMembers(getDB()), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const origin = sameOrigin(req);
  if (origin) return origin;
  try {
    const b = await req.json();
    if (typeof b.id !== "string") throw new Error("缺少账号");
    if (b.action === "grant") grantMembership(getDB(), b.id, b.until);
    else if (b.action === "reset-password")
      setMemberPassword(getDB(), b.id, b.password);
    else throw new Error("未知操作");
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
