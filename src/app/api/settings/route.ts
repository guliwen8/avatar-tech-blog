import { NextRequest, NextResponse } from "next/server";
import { getSettings, setSetting } from "@/server/repo";
import { changePassword } from "@/server/auth";
import { requireAuth } from "@/server/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getSettings());
}

export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const body = (await req.json()) as Record<string, string>;

  // 改密码（单独字段）
  if (body.newPassword) {
    changePassword("admin", body.newPassword);
    delete body.newPassword;
  }
  for (const [k, v] of Object.entries(body)) setSetting(k, String(v));
  return NextResponse.json({ ok: true });
}
