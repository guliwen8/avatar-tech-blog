import { NextRequest, NextResponse } from "next/server";
import { listAds, upsertAd, deleteAd, type Ad } from "@/server/repo";
import { requireAuth } from "@/server/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAuth();
  if (guard) return guard;
  return NextResponse.json(listAds(false));
}

export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const a = (await req.json()) as Ad;
  if (!a.id) a.id = "ad-" + Date.now();
  upsertAd(a);
  return NextResponse.json({ ok: true, id: a.id });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  deleteAd(id);
  return NextResponse.json({ ok: true });
}
