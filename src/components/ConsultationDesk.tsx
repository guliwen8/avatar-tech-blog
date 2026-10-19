"use client";
import { TicketAttachments } from "./TicketAttachments";
import { useEffect, useState, type FormEvent } from "react";
import type { Ticket } from "@/server/community";
type Detail = Ticket & {
  messages: {
    id: string;
    role: "admin" | "member";
    body: string;
    created_at: number;
  }[];
};
const statusText = { open: "待回复", replied: "已回复", closed: "已关闭" };
export function ConsultationDesk({ admin = false }: { admin?: boolean }) {
  const base = admin ? "/api/admin/consultations" : "/api/consultations";
  const [tickets, setTickets] = useState<Ticket[]>([]),
    [selected, setSelected] = useState(""),
    [detail, setDetail] = useState<Detail | null>(null),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [body, setBody] = useState("");
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(base, { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "加载失败");
        if (!cancelled) setTickets(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [base, revision]);
  useEffect(() => {
    let cancelled = false;
    setDetail(null);
    if (selected)
      fetch(base + "?id=" + encodeURIComponent(selected), { cache: "no-store" })
        .then(async (r) => {
          const d = await r.json();
          if (!r.ok) throw new Error(d.error || "加载失败");
          if (!cancelled) setDetail(d);
        })
        .catch((e) => {
          if (!cancelled) setError(e.message);
        });
    return () => {
      cancelled = true;
    };
  }, [base, selected, revision]);
  async function act(data: object) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "操作失败");
      setRevision((v) => v + 1);
      return d;
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接失败");
      return null;
    } finally {
      setBusy(false);
    }
  }
  async function create(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form),
      d = await act({ action: "create", subject: f.get("subject"), body });
    if (d) {
      form.reset();
      setBody("");
      setSelected(d.id);
    }
  }
  async function reply(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget,
      f = new FormData(form);
    if (await act({ action: "reply", id: selected, body: f.get("reply") }))
      form.reset();
  }
  return (
    <div className="consultation-desk">
      {!admin && (
        <section className="reader-card">
          <h2>提交新咨询</h2>
          <p className="content-note">
            提交后保存到本站，站长回复后可在下方查看。请勿填写密码或密钥。
          </p>
          <form onSubmit={create}>
            <label>
              问题标题
              <input name="subject" required maxLength={120} />
            </label>
            <label>
              问题详情
              <textarea
                name="body"
                required
                maxLength={12000}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="描述目标、运行环境、错误信息和已尝试的方法。"
              />
            </label>
            <div className="content-actions">
              <button className="primary-button" disabled={busy}>
                提交咨询
              </button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  try {
                    setBody(localStorage.getItem("avatar-consult-draft") || "");
                  } catch {
                    setError("无法读取旧草稿");
                  }
                }}
              >
                导入旧草稿
              </button>
            </div>
          </form>
        </section>
      )}
      {error && (
        <p role="alert" className="save-error">
          {error}
        </p>
      )}
      <section className="reader-card">
        <div className="desk-heading">
          <h2>{admin ? "咨询记录" : "我的咨询"}</h2>
          <button
            className="secondary-button"
            disabled={busy || loading}
            onClick={() => setRevision((v) => v + 1)}
          >
            刷新记录
          </button>
        </div>
        {loading && <p role="status">正在加载…</p>}
        {!loading && !tickets.length && <p>还没有咨询记录。</p>}
        <div className="ticket-list">
          {tickets.map((t) => (
            <button
              key={t.id}
              className={selected === t.id ? "selected" : ""}
              aria-pressed={selected === t.id}
              onClick={() => setSelected(t.id)}
            >
              <span>{t.subject}</span>
              <small>
                {t.username ? t.username + " · " : ""}
                {statusText[t.status]}
              </small>
            </button>
          ))}
        </div>
      </section>
      {detail && (
        <section className="reader-card ticket-detail">
          <h2>{detail.subject}</h2>
          <span className="ticket-status">{statusText[detail.status]}</span>
          <p className="ticket-body">{detail.body}</p>
          <TicketAttachments
            id={detail.id}
            closed={detail.status === "closed"}
            admin={admin}
            onChanged={() => setRevision((v) => v + 1)}
          />
          <div className="ticket-messages">
            {detail.messages.map((m) => (
              <article key={m.id} className={"ticket-message " + m.role}>
                <strong>{m.role === "admin" ? "站长回复" : "补充说明"}</strong>
                <time>
                  {new Date(m.created_at)
                    .toISOString()
                    .slice(0, 16)
                    .replace("T", " ")}{" "}
                  UTC
                </time>
                <p>{m.body}</p>
              </article>
            ))}
          </div>
          {detail.status !== "closed" && (
            <form onSubmit={reply}>
              <label>
                {admin ? "回复用户" : "补充说明"}
                <textarea name="reply" required maxLength={12000} />
              </label>
              <button className="primary-button" disabled={busy}>
                {admin ? "发送回复" : "提交补充"}
              </button>
            </form>
          )}
          {admin && (
            <button
              className="secondary-button"
              disabled={busy}
              onClick={() =>
                act({
                  action: detail.status === "closed" ? "reopen" : "close",
                  id: detail.id,
                })
              }
            >
              {detail.status === "closed" ? "重新打开咨询" : "关闭咨询"}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
