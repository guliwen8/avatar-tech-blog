"use client";
import { useState } from "react";

interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  features: string[];
  highlight: boolean;
}

interface CreatedOrder {
  orderId: string;
  planName: string;
  amount: number;
  payCode: string;
}

interface Payment {
  notice: string;
  wechatQr: string;
  alipayQr: string;
}

export function MembershipPlans({ plans }: { plans: Plan[] }) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [order, setOrder] = useState<CreatedOrder | null>(null);
  const [payment, setPayment] = useState<Payment | null>(null);
  const [done, setDone] = useState(false);

  async function open(plan: Plan) {
    setBusy(plan.id);
    setError("");
    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "create", planId: plan.id }),
      });
      const d = await r.json();
      if (r.status === 401) {
        window.location.href = "/login?next=/vip";
        return;
      }
      if (!r.ok) throw new Error(d.error || "下单失败");
      setOrder(d.order);
      setPayment(d.payment);
      setDone(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "下单失败");
    } finally {
      setBusy("");
    }
  }

  async function submitted() {
    if (!order) return;
    setBusy("submit");
    setError("");
    try {
      const r = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submit", orderId: order.orderId }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "提交失败");
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "提交失败");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="vip-plans" id="plans">
      <div className="section-heading">
        <h2>选择你的会员方案</h2>
        <p>扫码付款后点「我已付款」，站长核对到账即开通。</p>
      </div>

      {error && (
        <p role="alert" className="save-error">
          {error}
        </p>
      )}

      {!plans.length && <p>会员方案暂未开放。</p>}
      <div className="plan-grid">
        {plans.map((p) => (
          <div className={`plan-card ${p.highlight ? "hot" : ""}`} key={p.id}>
            {p.highlight && <span className="hot-badge">推荐方案</span>}
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
              type="button"
              className="plan-buy"
              disabled={!!busy}
              onClick={() => void open(p)}
            >
              {busy === p.id ? "处理中…" : "立即开通"}
            </button>
          </div>
        ))}
      </div>

      {order && payment && (
        <div
          className="pay-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="扫码支付"
        >
          <div className="pay-dialog">
            <h3>扫码支付 ¥{order.amount}</h3>
            <p className="hint">{payment.notice}</p>

            <div className="pay-code-box">
              <span>付款码</span>
              <code className="pay-code">{order.payCode}</code>
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  void navigator.clipboard?.writeText(order.payCode);
                }}
              >
                复制
              </button>
            </div>

            <div className="pay-qrs">
              {payment.wechatQr && (
                <figure>
                  <img src={payment.wechatQr} alt="微信收款码" width={180} height={180} />
                  <figcaption>微信支付</figcaption>
                </figure>
              )}
              {payment.alipayQr && (
                <figure>
                  <img src={payment.alipayQr} alt="支付宝收款码" width={180} height={180} />
                  <figcaption>支付宝</figcaption>
                </figure>
              )}
            </div>

            {done ? (
              <p className="pay-done">
                已提交，等待站长核对到账后开通会员。可以关闭此窗口。
              </p>
            ) : (
              <p className="hint">
                转账时请在备注里填写付款码 <strong>{order.payCode}</strong>，
                否则无法对上你的订单。
              </p>
            )}

            <div className="row">
              {!done && (
                <button
                  type="button"
                  className="primary-button"
                  disabled={!!busy}
                  onClick={() => void submitted()}
                >
                  {busy === "submit" ? "提交中…" : "我已付款"}
                </button>
              )}
              <button
                type="button"
                className="secondary-button"
                onClick={() => {
                  setOrder(null);
                  setPayment(null);
                  setDone(false);
                }}
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
