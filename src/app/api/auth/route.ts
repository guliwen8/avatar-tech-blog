import { NextRequest, NextResponse } from "next/server";
import { login, logout, isAuthed } from "@/server/auth";

export const dynamic = "force-dynamic";

// 查询登录状态
export async function GET() {
  return NextResponse.json({ authed: await isAuthed() });
}

// 登录 / 登出
export async function POST(req: NextRequest) {
  const body = await req.json();
  if (body.action === "logout") {
    await logout();
    return NextResponse.json({ ok: true });
  }
  const ok = await login(body.username || "", body.password || "");
  return NextResponse.json({ ok });
}
