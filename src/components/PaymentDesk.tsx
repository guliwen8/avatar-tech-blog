"use client";
import { useCallback, useEffect, useState } from "react";

interface PendingOrder {
  id: string;
  plan_name: string;
  amount: number;
  status: string;
  pay_code: string;
  contact: string;
  created_at: string;
  submitted_at: string | null;
  order_note: string;
}

interface PayConfig {
  enabled: boolean;
  notice: string;
  wechatQr: string;
  alipayQr: string;
}

const STATUS_TEXT: Record<string, string> = {
  pending: "等待付款",
  submitted: "已付款待核对",
  paid: "已收款",
  rejected: "已驳回",
  refunded: "已退款",
  cancelled: "已取消",
};

async function api(url: string, init?: RequestInit) {
  const r = await fetch(url, { cache: "no-store", ...init });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || "操作失败");
  return d;
}

export function PaymentDesk() {
  const [cfg, setCfg] = useState<PayConfig | null>(null);
  const [orders, setOrders] = useState<PendingOrder[]>([]);
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    try {
      const [c, o] = await Promise.all([
        api("/api/admin/payment-config"),
        api("/api/orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "pending" }),
        }),
      ]);
      setCfg({ ...c, raw: undefined });
      setNotice(c.notice || "");
      setOrders(o);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "加载失败");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function upload(kind: "wechat" | "alipay", file: File) {
    setBusy(kind);
    setErr("");
    setMsg("");
    try {
      const q = new URLSearchParams({ purpose: "payment", name: file.name });
      const d = await api("/api/files?" + q, { method: "POST", body: file });
      const id = d.file?.id;
      if (!id) throw new Error("上传返回异常");
      await api("/api/admin/payment-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [kind === "wechat" ? "wechatQr" : "alipayQr"]: id,
          enabled: cfg?.enabled ?? false,
          notice,
        }),
      });
      setMsg("收款码已更新");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "上传失败");
    } finally {
      setBusy("");
    }
  }

  async function saveConfig(enabled: boolean) {
    setBusy("cfg");
    setErr("");
    setMsg("");
    try {
      await api("/api/admin/payment-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, notice }),
      });
      setMsg(enabled ? "已开启在线开通" : "已关闭在线开通");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy("");
    }
  }

  async function act(action: string, id: string, extra: object = {}) {
    setBusy(id + action);
    setErr("");
    setMsg("");
    try {
      const d = await api("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, orderId: id, ...extra }),
      });
      setMsg(
        action === "confirm" && d.untilText
          ? `已收款，会员开通至 ${d.untilText}`
          : "操作成功",
      );
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="payment-desk">
      <p className="hint">
        用户下单后会拿到 6 位付款码，转账时填在备注里。核对账单金额与付款码无误后，
        点「确认收款」才会开通会员——<strong>没收到钱就不要点</strong>。
      </p>

      {err && <p role="alert" className="save-error">{err}</p>}
      {msg && <p role="status">{msg}</p>}

      <section className="panel">
        <h2>收款码</h2>
        <div className="qr-grid">
          {(["wechat", "alipay"] as const).map((kind) => {
            const url = kind === "wechat" ? cfg?.wechatQr : cfg?.alipayQr;
            return (
              <div key={kind} className="qr-card">
                <h3>{kind === "wechat" ? "微信支付" : "支付宝"}</h3>
                {url ? (
                  <img src={url} alt={kind === "wechat" ? "微信收款码" : "支付宝收款码"} width={160} height={160} />
                ) : (
                  <p className="hint">尚未上传</p>
                )}
                <label className="upload-btn">
                  {busy === kind ? "上传中…" : url ? "更换图片" : "上传图片"}
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    hidden
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void upload(kind, f);
                      e.currentTarget.value = "";
                    }}
                  />
                </label>
              </div>
            );
          })}
        </div>

        <label className="field">
          付款说明
          <textarea
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
            rows={3}
            maxLength={300}
            placeholder="转账时请务必在备注里填写下方付款码…"
          />
        </label>

        <div className="row">
          <button
            type="button"
            className="primary-button"
            disabled={busy === "cfg" || (!cfg?.wechatQr && !cfg?.alipayQr)}
            onClick={() => void saveConfig(true)}
          >
            开启在线开通
          </button>
          <button
            type="button"
            className="secondary-button"
            disabled={busy === "cfg"}
            onClick={() => void saveConfig(false)}
          >
            关闭
          </button>
          <span className="hint">
            当前状态：{cfg?.enabled ? "已开启" : "已关闭"}
          </span>
        </div>
      </section>

      <section className="panel">
        <h2>待核对订单（{orders.length}）</h2>
        {!orders.length && <p className="hint">暂无待核对订单。</p>}
        {orders.map((o) => (
          <article key={o.id} className="order-card">
            <header>
              <strong>{o.plan_name}</strong>
              <span className="amount">¥{o.amount}</span>
              <span className="badge">{STATUS_TEXT[o.status] || o.status}</span>
            </header>
            <p>
              付款码 <code className="pay-code">{o.pay_code}</code>
              <span className="hint"> · {o.contact || "未填联系方式"}</span>
            </p>
            <p className="hint">
              下单 {o.created_at}
              {o.submitted_at ? ` · 已提交 ${o.submitted_at}` : ""}
              {o.order_note ? ` · 备注：${o.order_note}` : ""}
            </p>
            <div className="row">
              <button
                type="button"
                className="primary-button"
                disabled={!!busy}
                onClick={() => void act("confirm", o.id)}
              >
                确认收款并开通
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={!!busy}
                onClick={() => {
                  const note = window.prompt("驳回原因（用户可见）", "未收到款项");
                  if (note !== null) void act("reject", o.id, { note });
                }}
              >
                驳回
              </button>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}
