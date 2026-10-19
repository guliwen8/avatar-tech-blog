import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "node:crypto";
import {
  currentMember,
  MEMBER_COOKIE,
  sameOrigin,
  fail,
} from "@/server/member-session";
import { getDB } from "@/server/db";
import {
  registerMember,
  authenticateMember,
  createMemberSession,
  revokeMemberSession,
  rateLimit,
  setMemberPassword,
} from "@/server/community";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(
    { member: await currentMember() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function POST(req: NextRequest) {
  const origin = sameOrigin(req);
  if (origin) return origin;
  try {
    const body = await req.json(),
      db = getDB(),
      jar = await cookies();
    if (body.action === "logout") {
      const token = jar.get(MEMBER_COOKIE)?.value;
      if (token) revokeMemberSession(db, token);
      jar.delete(MEMBER_COOKIE);
      return NextResponse.json({ ok: true });
    }
    if (body.action === "password") {
      const m = await currentMember();
      if (!m) return NextResponse.json({ error: "请先登录" }, { status: 401 });
      if (!rateLimit(db, "password:" + m.id, 6, 900000))
        return NextResponse.json(
          { error: "尝试过于频繁，请稍后重试" },
          { status: 429 },
        );
      if (!authenticateMember(db, m.username, body.currentPassword))
        return NextResponse.json({ error: "当前密码不正确" }, { status: 400 });
      setMemberPassword(db, m.id, body.password);
      jar.delete(MEMBER_COOKIE);
      return NextResponse.json({ ok: true });
    }
    if (body.action !== "register" && body.action !== "login")
      return NextResponse.json({ error: "未知操作" }, { status: 400 });
    const login = String(body.login || body.email || "")
      .slice(0, 254)
      .trim()
      .normalize("NFKC")
      .toLowerCase();
    const key = crypto.createHash("sha256").update(login).digest("hex");
    if (
      !rateLimit(db, "auth-global", 100, 900000) ||
      !rateLimit(db, "auth:" + key, 10, 900000)
    )
      return NextResponse.json(
        { error: "尝试过于频繁，请稍后重试" },
        { status: 429 },
      );
    if (body.action === "register" && body.acceptTerms !== true)
      return NextResponse.json(
        { error: "请阅读并同意服务说明与隐私说明" },
        { status: 400 },
      );
    const m =
      body.action === "register"
        ? registerMember(db, body)
        : authenticateMember(db, body.login, body.password);
    if (!m)
      return NextResponse.json({ error: "账号或密码不正确" }, { status: 401 });
    const session = createMemberSession(db, m.id);
    jar.set(MEMBER_COOKIE, session.token, {
      httpOnly: true,
      sameSite: "lax",
      secure:
        req.nextUrl.protocol === "https:" ||
        req.headers.get("x-forwarded-proto") === "https",
      path: "/",
      maxAge: 7 * 86400,
    });
    return NextResponse.json({ ok: true, member: m });
  } catch (error) {
    return fail(error);
  }
}
