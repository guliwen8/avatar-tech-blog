import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/guard";
import { sameOrigin, fail } from "@/server/member-session";
import { getDB } from "@/server/db";
import { privateFileRoot } from "@/server/file-runtime";
import { rateLimit } from "@/server/community";
import {
  generateArticleImage,
  resolveImageConfig,
} from "@/server/article-images";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 150;
export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const origin = sameOrigin(req);
  if (origin) return origin;
  try {
    const input = await req.json();
    const db = getDB(),
      config = resolveImageConfig(db);
    if (!config.enabled || !config.apiKey)
      return NextResponse.json(
        { error: "请先在 AI 服务配置中启用图片生成" },
        { status: 409 },
      );
    if (!rateLimit(db, "editorial:images", 20, 3600000))
      return NextResponse.json(
        { error: "每小时最多生成 20 张图片，请稍后重试" },
        { status: 429 },
      );
    const image = await generateArticleImage(
      db,
      privateFileRoot(),
      config,
      input,
      req.signal,
    );
    return NextResponse.json(
      { image },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
