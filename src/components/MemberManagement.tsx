"use client";
import { useEffect, useState, type FormEvent } from "react";
import type { Member } from "@/server/community";
export function MemberManagement() {
  const [members, setMembers] = useState<Member[]>([]),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/admin/members", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        if (active) setMembers(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  async function send(data: object) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const r = await fetch("/api/admin/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "操作失败");
      setRevision((v) => v + 1);
      setMessage("已保存");
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接失败");
      return false;
    } finally {
      setBusy(false);
    }
  }
  function grant(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      date = String(f.get("until") || "");
    void send({
      action: "grant",
      id,
      until: date ? new Date(date + "T23:59:59Z").getTime() : 0,
    });
  }
  async function reset(e: FormEvent<HTMLFormElement>, id: string) {
    e.preventDefault();
    const form = e.currentTarget,
      p = new FormData(form).get("password");
    if (await send({ action: "reset-password", id, password: p })) form.reset();
  }
  return (
    <div className="member-management">
      <p>
        仅在确认开通后设置有效期。重置密码前请先核验账号归属，并通过已确认的渠道交付新密码。
      </p>
      {error && (
        <p role="alert" className="save-error">
          {error}
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {!members.length && <p>尚无读者账号。</p>}
      {members.map((m) => (
        <section className="reader-card" key={m.id}>
          <h2>{m.username}</h2>
          <p>{m.email}</p>
          <p>
            {m.memberUntil > Date.now() ? "会员有效" : "普通读者 / 会员已到期"}
          </p>
          <form onSubmit={(e) => grant(e, m.id)}>
            <label>
              到期日期（UTC，留空取消会员）
              <input
                key={m.memberUntil}
                type="date"
                name="until"
                defaultValue={
                  m.memberUntil
                    ? new Date(m.memberUntil).toISOString().slice(0, 10)
                    : ""
                }
              />
            </label>
            <button className="primary-button" disabled={busy}>
              保存会员有效期
            </button>
          </form>
          <details>
            <summary>重置账号密码</summary>
            <form onSubmit={(e) => reset(e, m.id)}>
              <label>
                新密码
                <input
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  minLength={10}
                  maxLength={72}
                  required
                />
              </label>
              <button className="secondary-button" disabled={busy}>
                重置密码并撤销该账号会话
              </button>
            </form>
          </details>
        </section>
      ))}
    </div>
  );
}
