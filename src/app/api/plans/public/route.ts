import { NextResponse } from "next/server";
import { listPlans } from "@/server/repo";

export const dynamic = "force-dynamic";

// 公开接口：只返回启用的套餐（会员页用）
export async function GET() {
  return NextResponse.json(listPlans(true));
}
