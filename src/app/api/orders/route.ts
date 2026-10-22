import { NextRequest, NextResponse } from "next/server";
import { getDB } from "@/server/db";
import { requireAuth } from "@/server/guard";
import { currentMember, sameOrigin } from "@/server/member-session";
import { rateLimit, grantMembership } from "@/server/community";
import {
  createOrder,
  getOrder,
  getPlan,
  listOrders,
  listPendingOrders,
  markOrderPaid,
  markOrderRejected,
  markOrderRefunded,
  markOrderSubmitted,
  type Order,
} from "@/server/repo";
import { publicPaymentConfig } from "@/server/payment-config";
import {
  extendUntil,
  formatUntil,
  orderId,
  payCode,
  planDurationMs,
} from "@/lib/membership";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const json = (data: unknown, status = 200) =>
  NextResponse.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store" },
  });

/** 给用户看的订单视图，不含任何他人信息。 */
function userView(o: Order) {
  return {
    orderId: o.id,
    planName: o.plan_name,
    amount: o.amount,
    status: o.status,
    payCode: o.pay_code,
    createdAt: o.created_at,
  };
}

/** 生成不冲突的订单号（同一天内 6 位随机，冲突概率极低但仍重试）。 */
function freshOrderId(): string {
  const db = getDB();
  for (let i = 0; i < 5; i++) {
    const id = orderId();
    if (!db.prepare("SELECT 1 FROM orders WHERE id=?").get(id)) return id;
  }
  throw new Error("订单号生成失败，请重试");
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "请求格式不正确" }, 400);
  }
  const action = String(body.action ?? "");
  const db = getDB();

  // ---------- 用户侧：下单 ----------
  if (action === "create") {
    const member = await currentMember();
    if (!member)
      return json({ error: "请先登录后再开通会员" }, 401);
    const plan = getPlan(String(body.planId ?? ""));
    if (!plan || !plan.enabled)
      return json({ error: "该套餐不可用" }, 400);

    const pay = publicPaymentConfig(db);
    if (!pay.enabled)
      return json(
        { error: "在线开通尚未开启，请通过人工咨询办理" },
        503,
      );

    if (!rateLimit(db, "order:" + member.id, 3, 300000))
      return json({ error: "操作过于频繁，请 5 分钟后再试" }, 429);

    // 同套餐已有未支付订单时直接复用，避免刷出一堆废单
    const existing = db
      .prepare(
        `SELECT * FROM orders WHERE member_id=? AND plan_id=? AND status='pending'
         ORDER BY created_at DESC LIMIT 1`,
      )
      .get(member.id, plan.id) as Order | undefined;
    if (existing)
      return json({ order: userView(existing), payment: pay, reused: true });

    const id = freshOrderId();
    createOrder({
      id,
      plan_id: plan.id,
      plan_name: plan.name,
      amount: plan.price,
      method: "manual",
      contact: member.email || member.username,
      member_id: member.id,
      pay_code: payCode(),
    });
    const created = getOrder(id);
    return json({ order: created ? userView(created) : null, payment: pay });
  }

  // ---------- 用户侧：我已付款 ----------
  if (action === "submit") {
    const member = await currentMember();
    if (!member) return json({ error: "请先登录" }, 401);
    const order = getOrder(String(body.orderId ?? ""));
    if (!order || order.member_id !== member.id)
      return json({ error: "订单不存在" }, 404);
    if (!markOrderSubmitted(order.id, String(body.note ?? "")))
      return json({ error: "该订单已提交或已处理，无需重复提交" }, 409);
    return json({ ok: true });
  }

  // ---------- 用户侧：查状态 ----------
  if (action === "status") {
    const member = await currentMember();
    if (!member) return json({ error: "请先登录" }, 401);
    const order = getOrder(String(body.orderId ?? ""));
    if (!order || order.member_id !== member.id)
      return json({ error: "订单不存在" }, 404);
    return json(userView(order));
  }

  // ---------- 管理员侧 ----------
  const guard = await requireAuth();
  if (guard) return guard;
  const origin = sameOrigin(req);
  if (origin) return origin;

  if (action === "list") return json(listOrders());
  if (action === "pending") return json(listPendingOrders());

  if (action === "confirm") {
    const order = getOrder(String(body.orderId ?? ""));
    if (!order) return json({ error: "订单不存在" }, 404);
    if (!order.member_id)
      return json({ error: "订单未绑定会员账号，无法自动开通" }, 400);
    const plan = getPlan(order.plan_id);
    const addMs = plan ? planDurationMs(plan.period) : 30 * 86400000;

    const row = db
      .prepare("SELECT member_until FROM members WHERE id=?")
      .get(order.member_id) as { member_until: number } | undefined;
    if (!row) return json({ error: "会员账号不存在" }, 404);
    const until = extendUntil(row.member_until, addMs);

    // 幂等：条件更新成功才开通，防止重复确认导致重复加时长
    const applied = db.transaction(() => {
      if (!markOrderPaid(order.id, { operated_by: "admin", granted_until: until }))
        return false;
      grantMembership(db, order.member_id, until);
      return true;
    })();
    if (!applied)
      return json({ error: "订单状态已变化，未重复开通" }, 409);
    return json({ ok: true, until, untilText: formatUntil(until) });
  }

  if (action === "reject") {
    const order = getOrder(String(body.orderId ?? ""));
    if (!order) return json({ error: "订单不存在" }, 404);
    if (!markOrderRejected(order.id, String(body.note ?? "未收到款项")))
      return json({ error: "该订单已处理，无法驳回" }, 409);
    return json({ ok: true });
  }

  if (action === "refund") {
    const order = getOrder(String(body.orderId ?? ""));
    if (!order) return json({ error: "订单不存在" }, 404);
    if (!markOrderRefunded(order.id, order.amount, String(body.note ?? "管理员退款")))
      return json({ error: "只有已收款订单可以退款" }, 409);

    // 只有当会员期仍是本单开通的那一档时才回滚，避免动到后续订单
    let rolledBack = false;
    if (order.member_id && order.granted_until) {
      const plan = getPlan(order.plan_id);
      const addMs = plan ? planDurationMs(plan.period) : 30 * 86400000;
      const row = db
        .prepare("SELECT member_until FROM members WHERE id=?")
        .get(order.member_id) as { member_until: number } | undefined;
      if (row && row.member_until === order.granted_until) {
        grantMembership(db, order.member_id, Math.max(0, order.granted_until - addMs));
        rolledBack = true;
      }
    }
    return json({ ok: true, rolledBack });
  }

  return json({ error: "未知操作" }, 400);
}
