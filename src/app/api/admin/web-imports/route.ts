import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/guard";
import { sameOrigin, fail } from "@/server/member-session";
import { getDB } from "@/server/db";
import { rateLimit } from "@/server/community";
import { readWebSource, readFeedArticle } from "@/server/web-source.mjs";
import { normalizeWebUrl } from "@/server/web-url.mjs";
import {
  findWebDraft,
  saveWebDraft,
  storeWebCandidate,
} from "@/server/web-imports";
import { upsertPost, getPost, type Post } from "@/server/repo";
import { getAIConfig } from "@/server/editorial-ai";
import { generateEditorial } from "@/server/editorial-generator";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;
const reply = (data: unknown) =>
  NextResponse.json(data, {
    headers: { "Cache-Control": "private, no-store" },
  });
export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const origin = sameOrigin(req);
  if (origin) return origin;
  try {
    const b = await req.json();
    const url = normalizeWebUrl(b.url);
    const db = getDB();
    if (b.action !== "feed" && b.action !== "collect") throw Error("无效操作");
    if (!rateLimit(db, "web:" + b.action, 10, 3600000))
      return NextResponse.json(
        { error: "每小时最多执行 10 次此操作" },
        { status: 429 },
      );
    if (b.action === "feed")
      return reply(await readWebSource(url, "feed", req.signal));
    if (typeof b.generate !== "boolean") throw Error("请选择仅采集或 AI 整理");
    const existing = findWebDraft(db, url);
    if (existing) return reply({ ...existing, reused: true });
    const fromFeed = b.feedUrl
      ? await readFeedArticle(normalizeWebUrl(b.feedUrl), url, req.signal)
      : null;
    const material =
      fromFeed || (await readWebSource(url, "article", req.signal));
    const result = saveWebDraft(db, url, material as any, (p) =>
      upsertPost(p as Post),
    );
    if (result.reused || !b.generate) return reply(result);
    try {
      if (!rateLimit(db, "editorial:generate", 10, 3600000))
        throw Error("AI 生成达到每小时 10 次上限");
      const draft = getPost(result.slug);
      if (!draft?.editorial) throw Error("草稿读取失败");
      const candidate = await generateEditorial(
        getAIConfig(db),
        draft.editorial,
        req.signal,
      );
      storeWebCandidate(db, result.slug, draft.editorial.source, candidate);
      return reply({ ...result, generated: true });
    } catch (e) {
      return reply({
        ...result,
        generated: false,
        error:
          "正文已保存为素材草稿；" +
          (e instanceof Error && e.message.startsWith("AI ")
            ? e.message
            : "AI 整理未完成，请到草稿中检查配置后重试"),
      });
    }
  } catch (e) {
    return fail(e);
  }
}
