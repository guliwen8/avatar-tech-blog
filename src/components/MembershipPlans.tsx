"use client";

import { useEffect, useRef, useState } from "react";

interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  features: string[];
  highlight: boolean;
}

export function MembershipPlans({ plans }: { plans: Plan[] }) {
  const dialog = useRef<HTMLDivElement>(null);
  const [order, setOrder] = useState<{
    orderId: string;
    planName: string;
    amount: number;
  } | null>(null);
  const [paid, setPaid] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!order) return;
    const trigger = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLButtonElement>("button")?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOrder(null);
      if (event.key !== "Tab") return;
      const buttons = dialog.current?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      );
      if (!buttons?.length) return;
      const first = buttons[0],
        last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKey);
      trigger?.focus();
    };
  }, [order]);

  async function buy(plan: Plan) {
    setError("");
    setBusy(true);
    try {
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
      } else {
        setError(data.error || "暂时无法创建模拟订单，请稍后重试。");
      }
    } catch {
      setError("网络连接失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  async function mockPay() {
    if (!order) return;
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "mock-pay", orderId: order.orderId }),
      });
      const data = await res.json();
      if (data.status === "paid") setPaid(true);
      else setError(data.error || "模拟支付未完成，请重试。");
    } catch {
      setError("网络连接失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="membership-plans">
      <section className="vip-plans" id="plans">
        <div className="section-heading">
          <h2>选择你的会员方案</h2>
          <p>套餐由本站配置，真实收款与会员开通暂未开放。</p>
        </div>
        {error && (
          <p className="form-message" role="alert">
            {error}
          </p>
        )}
        {plans.length === 0 && (
          <p className="catalog-empty">
            会员方案暂未开放，欢迎先浏览免费内容。
          </p>
        )}
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
              <button
                className="plan-buy"
                disabled={busy}
                onClick={() => buy(p)}
              >
                模拟体验（不扣款）
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* 保留现有模拟订单流程，明确标识，不代表真实付费权益。 */}
      {order && (
        <div className="pay-mask" onClick={() => setOrder(null)}>
          <div
            className="pay-box"
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-label="模拟订单"
            onClick={(e) => e.stopPropagation()}
          >
            {!paid ? (
              <>
                <h3>模拟订单确认</h3>
                {error && (
                  <p role="alert" className="form-message">
                    {error}
                  </p>
                )}
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
                <p className="simulation-note">
                  这是模拟体验，不会扣款，也不会开通真实会员权益。
                </p>
                <button className="pay-btn" disabled={busy} onClick={mockPay}>
                  ✅ 模拟支付成功
                </button>
                <button className="pay-cancel" onClick={() => setOrder(null)}>
                  取消
                </button>
              </>
            ) : (
              <div className="pay-done">
                <div className="done-ico">🎉</div>
                <h3>模拟体验已完成</h3>
                <p>
                  「{order.planName}」模拟订单已记录。
                  <br />
                  本次不会扣款，也不会开通真实会员权益。
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
