"use client";

import { useEffect, useState } from "react";
import { AdminShell, useAdminReady } from "../AdminShell";
import { getOrders, type Order } from "../store";

function OrdersInner() {
  const ready = useAdminReady();
  const [orders, setOrders] = useState<Order[]>([]);

  useEffect(() => {
    if (ready) getOrders().then(setOrders).catch(() => {});
  }, [ready]);

  const paid = orders.filter((o) => o.status === "paid");
  const revenue = paid.reduce((s, o) => s + o.amount, 0);

  return (
    <>
      <div className="stat-grid">
        <div className="stat-card">
          <div className="n">{orders.length}</div>
          <div className="l">订单总数</div>
        </div>
        <div className="stat-card">
          <div className="n">{paid.length}</div>
          <div className="l">已支付</div>
        </div>
        <div className="stat-card">
          <div className="n">¥{revenue}</div>
          <div className="l">累计收入</div>
        </div>
        <div className="stat-card">
          <div className="n">{orders.length - paid.length}</div>
          <div className="l">待支付</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>全部订单</h3>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>订单号</th>
              <th>套餐</th>
              <th>金额</th>
              <th>方式</th>
              <th>状态</th>
              <th>联系方式</th>
              <th>时间</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "#999" }}>
                  还没有订单
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o.id}>
                  <td style={{ fontSize: 12 }}>{o.id}</td>
                  <td>{o.plan_name}</td>
                  <td>¥{o.amount}</td>
                  <td>{o.method}</td>
                  <td>
                    {o.status === "paid" ? "✅ 已支付" : "⏳ 待支付"}
                  </td>
                  <td>{o.contact || "-"}</td>
                  <td style={{ fontSize: 12 }}>{o.created_at}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function OrdersPage() {
  return (
    <AdminShell title="订单记录" active="/admin/orders">
      <OrdersInner />
    </AdminShell>
  );
}
