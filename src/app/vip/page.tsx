"use client";

import { useEffect, useState } from "react";

interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  features: string[];
  highlight: boolean;
}

export default function VipPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [order, setOrder] = useState<{
    orderId: string;
    planName: string;
    amount: number;
  } | null>(null);
  const [paid, setPaid] = useState(false);

  useEffect(() => {
    // 从后端读取启用的套餐（公开接口）
    fetch("/api/plans/public")
      .then((r) => r.json())
      .then(setPlans)
      .catch(() => setPlans([]));
  }, []);

  async function buy(plan: Plan) {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planId: plan.id, method: "mock" }),
    });
    const data = await res.json();
    if (data.ok) {
      setOrder({
        orderId: data.orderId,
        planName: data.planName,
        amount: data.amount,
      });
      setPaid(false);
    }
  }

  async function mockPay() {
    if (!order) return;
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "mock-pay", orderId: order.orderId }),
    });
    const data = await res.json();
    if (data.status === "paid") setPaid(true);
  }

  return (
    <div className="vip-page">
      <section className="vip-hero">
        <div className="vip-eyebrow">持续更新 · 随时加入</div>
        <h1>
          不止是内容
          <br />
          <span className="gold">更是专属的深度支持</span>
        </h1>
        <p className="lead">
          汇聚精选深度文章、实战教程视频与一对一人工咨询，帮你构建长期成长壁垒。
        </p>
        <div className="vip-cta">
          <a className="vip-btn gold" href="#plans">
            💎 查看会员方案
          </a>
          <a className="vip-btn ghost" href="/">
            📖 浏览精选内容
          </a>
        </div>
        <div className="vip-points">
          <span>🛡️ 安全支付</span>
          <span>⚡ 即时开通</span>
          <span>🎖️ 专属服务</span>
          <span>🔄 持续更新</span>
        </div>
      </section>

      <section className="vip-stats">
        <div className="vip-stat">
          <div className="n">2,268</div>
          <div className="l">深度文章</div>
        </div>
        <div className="vip-stat">
          <div className="n">928</div>
          <div className="l">实战视频</div>
        </div>
        <div className="vip-stat">
          <div className="n">24h</div>
          <div className="l">人工咨询</div>
        </div>
        <div className="vip-stat">
          <div className="n">∞</div>
          <div className="l">远程服务</div>
        </div>
      </section>

      <section className="vip-plans" id="plans">
        <h2>选择你的会员方案</h2>
        <div className="plan-grid">
          {plans.map((p) => (
            <div key={p.id} className={`plan-card ${p.highlight ? "hot" : ""}`}>
              {p.highlight && <span className="hot-badge">最受欢迎</span>}
              <div className="pname">{p.name}</div>
              <div className="pprice">
                ¥{p.price}
                <small> {p.period}</small>
              </div>
              <ul>
                {p.features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
              <button className="plan-buy" onClick={() => buy(p)}>
                立即开通
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 下单 / 支付弹窗 */}
      {order && (
        <div className="pay-mask" onClick={() => setOrder(null)}>
          <div className="pay-box" onClick={(e) => e.stopPropagation()}>
            {!paid ? (
              <>
                <h3>订单确认</h3>
                <div className="pay-info">
                  <div>
                    <span>套餐</span>
                    <b>{order.planName}</b>
                  </div>
                  <div>
                    <span>金额</span>
                    <b className="price">¥{order.amount}</b>
                  </div>
                  <div>
                    <span>订单号</span>
                    <small>{order.orderId}</small>
                  </div>
                </div>
                <div className="pay-qr">
                  <div className="qr-ph">📱 支付二维码</div>
                  <p>
                    真实收款（微信 / 支付宝）将在接入商户号后在此显示二维码。
                    <br />
                    现在用下方按钮模拟完成支付。
                  </p>
                </div>
                <button className="pay-btn" onClick={mockPay}>
                  ✅ 模拟支付成功
                </button>
                <button className="pay-cancel" onClick={() => setOrder(null)}>
                  取消
                </button>
              </>
            ) : (
              <div className="pay-done">
                <div className="done-ico">🎉</div>
                <h3>支付成功！</h3>
                <p>
                  感谢开通「{order.planName}」会员。
                  <br />
                  订单已记录，可在后台「订单记录」查看。
                </p>
                <button className="pay-btn" onClick={() => setOrder(null)}>
                  完成
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
