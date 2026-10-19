import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { getDB } from "./db";
import { resolveMemberSession } from "./community";
export const MEMBER_COOKIE = "avatar_reader_session";
export async function currentMember() {
  const token = (await cookies()).get(MEMBER_COOKIE)?.value;
  return token ? resolveMemberSession(getDB(), token) : null;
}
export function sameOrigin(req: NextRequest): NextResponse | null {
  const origin = req.headers.get("origin"),
    host = req.headers.get("host");
  const proto =
    req.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    req.nextUrl.protocol.replace(":", "");
  if (!origin || !host || origin !== `${proto}://${host}`)
    return NextResponse.json(
      { error: "请求来源无效，请刷新页面后重试" },
      { status: 403 },
    );
  return null;
}
export function fail(error: unknown) {
  if ((error as { code?: string })?.code?.startsWith("SQLITE_"))
    return NextResponse.json(
      { error: "暂时无法保存，请稍后重试" },
      { status: 500 },
    );
  const message =
    error instanceof SyntaxError || error instanceof TypeError
      ? "请求格式不正确"
      : error instanceof Error
        ? error.message
        : "操作失败，请重试";
  return NextResponse.json({ error: message }, { status: 400 });
}
