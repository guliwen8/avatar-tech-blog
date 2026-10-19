import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/guard";
import { sameOrigin, fail } from "@/server/member-session";
import { getDB } from "@/server/db";
import {
  getAIConfig,
  publicAIConfig,
  saveAIConfig,
} from "@/server/editorial-ai";
export const dynamic = "force-dynamic";
export async function GET() {
  const guard = await requireAuth();
  if (guard) return guard;
  return NextResponse.json(publicAIConfig(getAIConfig(getDB())), {
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const origin = sameOrigin(req);
  if (origin) return origin;
  try {
    return NextResponse.json(saveAIConfig(getDB(), await req.json()), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return fail(e);
  }
}
