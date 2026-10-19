import { NextRequest, NextResponse } from "next/server";
import { listOrders, getOrder } from "@/server/repo";
import { requireAuth } from "@/server/guard";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "请求格式不正确" }, { status: 400 });
  }
  if (body.action === "list" || body.action === "status") {
    const guard = await requireAuth();
    if (guard) return guard;
    if (body.action === "list") return NextResponse.json(listOrders());
    const order = getOrder(body.orderId);
    return order
      ? NextResponse.json({ status: order.status })
      : NextResponse.json({ error: "订单不存在" }, { status: 404 });
  }
  if (body.action === "mock-pay")
    return NextResponse.json(
      { error: "模拟支付已关闭，不会开通会员" },
      { status: 410 },
    );
  return NextResponse.json(
    { error: "在线支付尚未开放，请通过人工咨询确认开通" },
    { status: 503 },
  );
}
