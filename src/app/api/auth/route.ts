import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { login, logout, isAuthed } from "@/server/auth";
import { sameOrigin, fail } from "@/server/member-session";
import { rateLimit } from "@/server/community";
import { getDB } from "@/server/db";
export const dynamic = "force-dynamic";
export async function GET() {
  return NextResponse.json(
    { authed: await isAuthed() },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
export async function POST(req: NextRequest) {
  const origin = sameOrigin(req);
  if (origin) return origin;
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw new Error("请求格式不正确");
    if (body.action === "logout") {
      await logout();
      return NextResponse.json({ ok: true });
    }
    if (body.action && body.action !== "login") throw new Error("无效操作");
    if (
      typeof body.username !== "string" ||
      body.username.length > 100 ||
      typeof body.password !== "string" ||
      Buffer.byteLength(body.password) > 72
    )
      throw new Error("用户名或密码格式不正确");
    const db = getDB();
    const key = crypto
      .createHash("sha256")
      .update(body.username.normalize("NFKC").toLowerCase())
      .digest("hex");
    if (
      !rateLimit(db, "admin:login:global", 100, 900000) ||
      !rateLimit(db, "admin:login:" + key, 10, 900000)
    )
      return NextResponse.json(
        { error: "尝试过于频繁，请 15 分钟后再试" },
        { status: 429, headers: { "Retry-After": "900" } },
      );
    const secure =
      req.nextUrl.protocol === "https:" ||
      req.headers.get("x-forwarded-proto")?.split(",")[0].trim() === "https";
    return NextResponse.json({
      ok: await login(body.username, body.password, secure),
    });
  } catch (error) {
    return fail(error);
  }
}
