import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/guard";
import { sameOrigin, fail } from "@/server/member-session";
import { getDB } from "@/server/db";
import { publicImageConfig, saveImageConfig } from "@/server/article-images";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET() {
  const guard = await requireAuth();
  if (guard) return guard;
  return NextResponse.json(publicImageConfig(getDB()), { headers });
}
export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const origin = sameOrigin(req);
  if (origin) return origin;
  try {
    return NextResponse.json(saveImageConfig(getDB(), await req.json()), {
      headers,
    });
  } catch (e) {
    return fail(e);
  }
}
