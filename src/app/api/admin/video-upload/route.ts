import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/guard";
import { sameOrigin, fail } from "@/server/member-session";
import { getDB } from "@/server/db";
import { rateLimit } from "@/server/community";
import {
  saveLocalVideo,
  removeLocalVideo,
  localVideoRoot,
} from "@/server/local-video";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const origin = sameOrigin(req);
  if (origin) return origin;
  try {
    if (!rateLimit(getDB(), "video:upload", 10, 3600000))
      return NextResponse.json(
        { error: "每小时最多上传 10 个视频" },
        { status: 429 },
      );
    if (!req.body) throw Error("请选择视频文件");
    const length = req.headers.get("content-length");
    const file = await saveLocalVideo(
      getDB(),
      localVideoRoot(),
      req.nextUrl.searchParams.get("name") || "",
      req.body,
      length === null ? undefined : Number(length),
    );
    return NextResponse.json(file, {
      status: 201,
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (e) {
    return fail(e);
  }
}
export async function DELETE(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const origin = sameOrigin(req);
  if (origin) return origin;
  try {
    await removeLocalVideo(
      getDB(),
      localVideoRoot(),
      req.nextUrl.searchParams.get("url") || "",
    );
    return NextResponse.json({ ok: true });
  } catch (e) {
    return fail(e);
  }
}
