import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/guard";
import { sameOrigin } from "@/server/member-session";
import { getDB } from "@/server/db";
import { rateLimit } from "@/server/community";
import {
  collectFeeds,
  readFeedSources,
  saveFeedSources,
} from "@/server/feed-collector";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const reply = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });

/** 读取当前订阅源清单。 */
export async function GET() {
  const guard = await requireAuth();
  if (guard) return guard;
  return reply({ sources: readFeedSources() });
}

/** 保存订阅源清单。 */
export async function PUT(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const origin = sameOrigin(req);
  if (origin) return origin;
  try {
    const body = await req.json();
    const count = saveFeedSources(body?.sources ?? body);
    return reply({ ok: true, count });
  } catch (error) {
    return reply(
      { error: error instanceof Error ? error.message : "订阅源配置无效" },
      400,
    );
  }
}

/**
 * 执行一次采集。
 * body: { limit?: number, minScore?: number, dryRun?: boolean }
 */
export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const origin = sameOrigin(req);
  if (origin) return origin;

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {};
  }

  const db = getDB();
  // 采集会抓外部站点，收紧频率：每小时 6 次
  if (!rateLimit(db, "feed-collect", 6, 3600000))
    return reply({ error: "每小时最多采集 6 次" }, 429);

  try {
    const report = await collectFeeds(
      {
        limit: typeof body.limit === "number" ? body.limit : undefined,
        minScore: typeof body.minScore === "number" ? body.minScore : undefined,
        dryRun: body.dryRun === true,
      },
      req.signal,
    );
    return reply(report);
  } catch (error) {
    return reply(
      { error: error instanceof Error ? error.message : "采集失败" },
      400,
    );
  }
}
