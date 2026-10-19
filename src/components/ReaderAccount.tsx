"use client";
import { useState, type FormEvent } from "react";
import type { Member } from "@/server/community";
export function ReaderAccount({ member }: { member: Member }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function send(body: object) {
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "操作失败");
      window.location.assign("/login");
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接失败");
      setBusy(false);
    }
  }
  function password(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (f.get("password") !== f.get("confirm")) {
      setError("两次密码不一致");
      return;
    }
    void send({
      action: "password",
      currentPassword: f.get("current"),
      password: f.get("password"),
    });
  }
  const active = member.memberUntil > Date.now();
  return (
    <div className="reader-account">
      <div className="section-heading">
        <h1>我的账号</h1>
        <p>你好，{member.username}</p>
      </div>
      <section className="reader-card">
        <h2>{active ? "会员有效" : "普通读者"}</h2>
        <p>
          {active
            ? `有效至 ${new Date(member.memberUntil).toISOString().slice(0, 10)}（UTC）`
            : "注册账号可以阅读登录可见的内容。会员内容需要另行开通。"}
        </p>
        <p>登录邮箱：{member.email}</p>
        <div className="content-actions">
          <a className="btn" href="/consult">
            我的咨询
          </a>
          <a className="btn" href="/vip">
            查看会员方案
          </a>
        </div>
        <p className="content-note">
          真实在线支付尚未接入。会员开通由站长确认并设置有效期。
        </p>
      </section>
      <section className="reader-card">
        <h2>修改密码</h2>
        <form onSubmit={password}>
          <label>
            当前密码
            <input
              name="current"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          <label>
            新密码
            <input
              name="password"
              type="password"
              required
              minLength={10}
              maxLength={72}
              autoComplete="new-password"
            />
          </label>
          <label>
            确认新密码
            <input
              name="confirm"
              type="password"
              required
              autoComplete="new-password"
            />
          </label>
          <button className="primary-button" disabled={busy}>
            修改密码并重新登录
          </button>
        </form>
      </section>
      {error && (
        <p role="alert" className="save-error">
          {error}
        </p>
      )}
      <button
        className="secondary-button"
        disabled={busy}
        onClick={() => send({ action: "logout" })}
      >
        退出读者账号
      </button>
    </div>
  );
}
