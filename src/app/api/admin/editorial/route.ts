import { editorialStream } from "@/server/editorial-stream";
import { generateEditorial } from "@/server/editorial-generator";
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/guard";
import { sameOrigin, fail } from "@/server/member-session";
import { getDB } from "@/server/db";
import { rateLimit } from "@/server/community";
import { renderArticleMarkdown } from "@/server/article-renderer";
import { normalizeEditorial } from "@/lib/editorial";
import { getAIConfig } from "@/server/editorial-ai";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 330;
export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const origin = sameOrigin(req);
  if (origin) return origin;
  try {
    const body = await req.json();
    if (body.action === "preview") {
      if (typeof body.content !== "string" || body.content.length > 50000)
        throw new Error("预览正文最多 50000 字符");
      const result = await renderArticleMarkdown(body.content);
      return NextResponse.json(
        { html: result.toString(), toc: result.data.toc },
        { headers: { "Cache-Control": "private, no-store" } },
      );
    }
    if (body.action !== "generate") throw new Error("无效操作");
    const input = normalizeEditorial(body);
    if (!input.source.trim()) throw new Error("请先输入原始素材");
    const config = getAIConfig(getDB());
    if (!config.enabled || !config.apiKey || !config.model)
      return NextResponse.json(
        { error: "请先在 AI 草稿配置页设置并启用服务" },
        { status: 409 },
      );
    if (!rateLimit(getDB(), "editorial:generate", 10, 3600000))
      return NextResponse.json(
        { error: "每小时最多生成 10 次，请稍后重试" },
        { status: 429 },
      );
    return new Response(
      editorialStream(
        (signal) => generateEditorial(config, input, signal),
        req.signal,
      ),
      {
        headers: {
          "Content-Type": "application/x-ndjson; charset=utf-8",
          "Cache-Control": "private, no-store, no-transform",
          "X-Accel-Buffering": "no",
        },
      },
    );
  } catch (error) {
    return fail(error);
  }
}
