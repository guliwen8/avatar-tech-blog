import { sameOrigin } from "@/server/member-session";
import { NextRequest, NextResponse } from "next/server";
import { listPlans, upsertPlan, deletePlan, type Plan } from "@/server/repo";
import { requireAuth } from "@/server/guard";

export const dynamic = "force-dynamic";

export async function GET() {
  const guard = await requireAuth();
  if (guard) return guard;
  return NextResponse.json(listPlans(false));
}

export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const origin = sameOrigin(req);
  if (origin) return origin;
  const p = (await req.json()) as Plan;
  if (!p.id) p.id = "plan-" + Date.now();
  upsertPlan(p);
  return NextResponse.json({ ok: true, id: p.id });
}

export async function DELETE(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const origin = sameOrigin(req);
  if (origin) return origin;
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "缺少 id" }, { status: 400 });
  deletePlan(id);
  return NextResponse.json({ ok: true });
}
