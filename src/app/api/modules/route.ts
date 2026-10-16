import { NextRequest, NextResponse } from "next/server";
import {
  listModules,
  upsertModule,
  deleteModule,
  type SiteModule,
} from "@/server/repo";
import { requireAuth } from "@/server/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAuth();
  if (guard) return guard;
  return NextResponse.json(listModules());
}

export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const m = (await req.json()) as SiteModule;
  if (!m.id) m.id = "mod-" + Date.now();
  upsertModule(m);
  return NextResponse.json({ ok: true, id: m.id });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  deleteModule(id);
  return NextResponse.json({ ok: true });
}
