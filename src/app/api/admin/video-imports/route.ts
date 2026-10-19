import { localVideoInfo } from "@/server/local-video";
import { NextRequest, NextResponse, after } from "next/server";
import { requireAuth } from "@/server/guard";
import { sameOrigin, fail } from "@/server/member-session";
import { getDB } from "@/server/db";
import {
  enqueueVideoJob,
  listVideoJobs,
  recoverVideoJobs,
  cancelVideoJob,
  retryVideoJob,
} from "@/server/video-jobs";
import { runPendingImports } from "@/server/video-worker";
import { rateLimit } from "@/server/community";
export const dynamic = "force-dynamic";
export const maxDuration = 600;
function wake() {
  after(async () => {
    await runPendingImports();
  });
}
export async function GET() {
  const guard = await requireAuth();
  if (guard) return guard;
  recoverVideoJobs(getDB());
  const jobs = listVideoJobs(getDB());
  if (jobs.some((j) => j.status === "queued")) wake();
  return NextResponse.json(jobs, {
    headers: { "Cache-Control": "private, no-store" },
  });
}
export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const origin = sameOrigin(req);
  if (origin) return origin;
  try {
    const body = await req.json();
    if (body.action === "cancel") {
      cancelVideoJob(getDB(), String(body.id));
      return NextResponse.json({ ok: true });
    }
    if (!rateLimit(getDB(), "video:enqueue", 10, 3600000))
      return NextResponse.json(
        { error: "每小时最多提交或重试 10 个视频任务" },
        { status: 429 },
      );
    if (body.action === "retry") {
      retryVideoJob(getDB(), String(body.id), body.transcript);
      wake();
      return NextResponse.json({ ok: true });
    }
    if (body.action !== "create") throw Error("无效操作");
    if (typeof body.url !== "string") throw Error("请填写视频链接");
    if (body.url.startsWith("local-video:")) localVideoInfo(getDB(), body.url);
    const result = enqueueVideoJob(getDB(), {
      url: body.url,
      template: body.template || "tutorial",
      style: body.style || "auto",
      transcript: body.transcript,
    });
    wake();
    return NextResponse.json(
      { ok: true, id: result.id },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (e) {
    return fail(e);
  }
}
