import { NextRequest, NextResponse } from "next/server";
import { getSettings, setSetting } from "@/server/repo";
import { currentAdmin, logout } from "@/server/auth";
import { replaceAdminPassword } from "@/server/admin-auth";
import { getDB } from "@/server/db";
import { sameOrigin, fail } from "@/server/member-session";
import { requireAuth } from "@/server/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const origin = sameOrigin(req);
  if (origin) return origin;
  try {
    const body = (await req.json()) as Record<string, string>;

    // 改密码（单独字段）
    if (Object.prototype.hasOwnProperty.call(body, "newPassword")) {
      const admin = await currentAdmin();
      if (!admin)
        return NextResponse.json({ error: "未登录" }, { status: 401 });
      replaceAdminPassword(getDB(), admin.id, body.newPassword);
      await logout();
      delete body.newPassword;
    }
    for (const [k, v] of Object.entries(body)) setSetting(k, String(v));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return fail(error);
  }
}
