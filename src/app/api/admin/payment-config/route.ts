import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/server/guard";
import { sameOrigin } from "@/server/member-session";
import { getDB } from "@/server/db";
import {
  getPaymentConfig,
  publicPaymentConfig,
  savePaymentConfig,
} from "@/server/payment-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const reply = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });

export async function GET() {
  const guard = await requireAuth();
  if (guard) return guard;
  const db = getDB();
  return reply({
    ...publicPaymentConfig(db),
    raw: getPaymentConfig(db),
  });
}

export async function PUT(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const origin = sameOrigin(req);
  if (origin) return origin;
  try {
    const body = await req.json();
    const db = getDB();
    savePaymentConfig(db, body);
    return reply({ ok: true, ...publicPaymentConfig(db) });
  } catch (error) {
    return reply(
      { error: error instanceof Error ? error.message : "保存失败" },
      400,
    );
  }
}
