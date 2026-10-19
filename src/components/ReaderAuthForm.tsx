"use client";
import { useState, type FormEvent } from "react";
export function ReaderAuthForm({
  mode,
  returnTo,
}: {
  mode: "login" | "register";
  returnTo: string;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const data = new FormData(e.currentTarget);
    if (mode === "register" && data.get("password") !== data.get("confirm")) {
      setError("两次密码不一致");
      return;
    }
    setBusy(true);
    try {
      const r = await fetch("/api/member", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: mode,
          login: data.get("login"),
          username: data.get("username"),
          email: data.get("email"),
          password: data.get("password"),
          acceptTerms: data.get("terms") === "on",
        }),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "操作失败");
      window.location.assign(returnTo);
    } catch (e) {
      setError(e instanceof Error ? e.message : "网络连接失败");
      setBusy(false);
    }
  }
  const suffix = "?redirect=" + encodeURIComponent(returnTo);
  return (
    <section className="reader-auth">
      <p className="member-kicker">阿凡达博客 · 读者账号</p>
      <h1>{mode === "login" ? "欢迎回来" : "创建账号"}</h1>
      <p>收藏知识，从一次阅读开始。</p>
      <form onSubmit={submit}>
        {mode === "register" ? (
          <>
            <label>
              用户名
              <input
                name="username"
                required
                minLength={2}
                maxLength={30}
                autoComplete="username"
              />
            </label>
            <label>
              邮箱
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                maxLength={254}
              />
            </label>
          </>
        ) : (
          <label>
            用户名或邮箱
            <input
              name="login"
              required
              autoComplete="username"
              maxLength={254}
            />
          </label>
        )}
        <label>
          密码
          <input
            name="password"
            type="password"
            required
            minLength={mode === "register" ? 10 : 1}
            maxLength={72}
            autoComplete={
              mode === "register" ? "new-password" : "current-password"
            }
          />
        </label>
        {mode === "register" && (
          <>
            <label>
              确认密码
              <input
                name="confirm"
                type="password"
                required
                autoComplete="new-password"
                maxLength={72}
              />
            </label>
            <p className="content-note">
              密码至少 10 位；邮箱用于登录，当前不发送验证邮件。
            </p>
            <label className="reader-consent">
              <input name="terms" type="checkbox" required />
              我已阅读并同意
              <a href="/terms" target="_blank">
                服务说明
              </a>
              和
              <a href="/privacy" target="_blank">
                隐私说明
              </a>
            </label>
          </>
        )}
        {error && (
          <p role="alert" className="save-error">
            {error}
          </p>
        )}
        <button className="primary-button" disabled={busy}>
          {busy ? "处理中…" : mode === "login" ? "登录" : "注册并登录"}
        </button>
      </form>
      <div className="reader-auth-links">
        <a href={(mode === "login" ? "/register" : "/login") + suffix}>
          {mode === "login" ? "还没有账号？注册" : "已有账号？登录"}
        </a>
        {mode === "login" && <a href="/forgot-password">忘记密码</a>}
      </div>
    </section>
  );
}
