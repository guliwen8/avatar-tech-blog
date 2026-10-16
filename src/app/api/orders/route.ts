import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  createOrder,
  getOrder,
  markOrderPaid,
  getPlan,
  listOrders,
} from "@/server/repo";
import { requireAuth } from "@/server/guard";

export const dynamic = "force-dynamic";

// 创建订单（公开，用户下单）
export async function POST(req: NextRequest) {
  const body = await req.json();

  // 后台查看订单列表
  if (body.action === "list") {
    const guard = await requireAuth();
    if (guard) return guard;
    return NextResponse.json(listOrders());
  }

  // 模拟支付：标记订单已支付（真实支付时由支付平台回调触发）
  if (body.action === "mock-pay") {
    const order = getOrder(body.orderId);
    if (!order) return NextResponse.json({ error: "订单不存在" }, { status: 404 });
    markOrderPaid(order.id);
    return NextResponse.json({ ok: true, status: "paid" });
  }

  // 查询订单状态（前台轮询）
  if (body.action === "status") {
    const order = getOrder(body.orderId);
    if (!order) return NextResponse.json({ error: "订单不存在" }, { status: 404 });
    return NextResponse.json({ status: order.status });
  }

  // 下单
  const plan = getPlan(body.planId);
  if (!plan) return NextResponse.json({ error: "套餐不存在" }, { status: 400 });

  const orderId = "ORD" + Date.now() + crypto.randomBytes(2).toString("hex");
  createOrder({
    id: orderId,
    plan_id: plan.id,
    plan_name: plan.name,
    amount: plan.price,
    method: body.method || "mock", // wechat / alipay / mock
    status: "pending",
    contact: body.contact || "",
  });

  // ===== 真实支付接入点（预留）=====
  // 这里之后接入微信支付/支付宝：
  //   1. 用商户号+密钥调用「统一下单」接口
  //   2. 拿到支付二维码链接 code_url，返回给前端生成二维码
  //   3. 支付平台异步回调 /api/pay/notify，校验签名后 markOrderPaid(orderId)
  // 现在是演示版：返回订单号，前端用「模拟支付」按钮完成流程。

  return NextResponse.json({
    ok: true,
    orderId,
    amount: plan.price,
    planName: plan.name,
    // payUrl: code_url,  // 真实支付时返回
  });
}
