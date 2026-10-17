"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { checkAuth, login, logout } from "./store";

const MENU = [
  { href: "/admin", ico: "📊", label: "仪表盘" },
  { href: "/admin/posts", ico: "📝", label: "文章管理" },
  { href: "/admin/categories", ico: "📂", label: "分类管理" },
  { href: "/admin/plans", ico: "💎", label: "会员套餐" },
  { href: "/admin/orders", ico: "🧾", label: "订单记录" },
  { href: "/admin/ads", ico: "📢", label: "广告位" },
  { href: "/admin/modules", ico: "🧩", label: "结构模块" },
  { href: "/admin/settings", ico: "⚙️", label: "站点设置" },
];

// 登录态 Context：子页面用它判断"是否已登录、是否可以安全请求数据"
const AuthReadyContext = createContext(false);

/**
 * 子页面用这个 hook 决定何时加载数据。
 * 只有返回 true（已确认登录）时，才去请求受保护 API，彻底避免未登录时的 401 循环。
 */
export function useAdminReady(): boolean {
  return useContext(AuthReadyContext);
}

// 后台外壳：未登录只显示登录页；登录后才渲染 children，并通过 Context 告知子页面可以请求数据
export function AdminShell({
  title,
  active,
  children,
}: {
  title: string;
  active: string;
  children: React.ReactNode;
}) {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [user, setUser] = useState("admin");
  const [pwd, setPwd] = useState("");
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    checkAuth()
      .then(setAuthed)
      .catch(() => setAuthed(false));
  }, []);

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (await login(user, pwd)) {
        setErr("");
        setAuthed(true);
      } else {
        setErr("用户名或密码错误，请重试");
      }
    } catch {
      setErr("登录失败，请稍后重试");
    } finally {
      setSubmitting(false);
    }
  }

  // 加载中：显示占位，不渲染任何子页面（子页面不挂载 = 不发请求）
  if (authed === null) {
    return (
      <div className="admin-root">
        <div className="login-wrap">
          <div className="login-card" style={{ textAlign: "center" }}>
            正在加载…
          </div>
        </div>
      </div>
    );
  }

  // 未登录：只显示登录页，绝不渲染 children
  if (!authed) {
    return (
      <div className="admin-root">
        <div className="login-wrap">
          <form className="login-card" onSubmit={doLogin}>
            <h1>阿凡达博客 · 管理后台</h1>
            <div className="sub">请登录以管理你的网站</div>
            <label>用户名</label>
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              placeholder="用户名"
              autoFocus
            />
            <label>密码</label>
            <input
              type="password"
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              placeholder="输入密码"
            />
            <button type="submit" disabled={submitting}>
              {submitting ? "登录中…" : "登录"}
            </button>
            {err && <div className="login-err">{err}</div>}
            <div className="login-hint">
              💡 默认账号 <b>admin</b> / 密码 <b>avatar2026</b>
              <br />
              登录后请在「站点设置」里修改成你自己的密码。
            </div>
          </form>
        </div>
      </div>
    );
  }

  // 已登录：渲染后台 + 通过 Context 告知子页面可以安全请求数据
  return (
    <AuthReadyContext.Provider value={true}>
      <div className="admin-root">
        <div className="admin-layout">
          <aside className="admin-sidebar">
            <div className="brand">
              阿凡达<span>·后台</span>
            </div>
            <nav className="admin-menu">
              {MENU.map((m) => (
                <a
                  key={m.href}
                  href={m.href}
                  className={active === m.href ? "active" : ""}
                >
                  <span className="ico">{m.ico}</span>
                  <span>{m.label}</span>
                </a>
              ))}
            </nav>
            <div
              className="logout"
              onClick={async () => {
                await logout();
                setAuthed(false);
              }}
            >
              🚪 退出登录
            </div>
          </aside>

          <div className="admin-main">
            <div className="admin-topbar">
              <h2>{title}</h2>
              <a href="/" target="_blank" className="view-site">
                🔗 查看网站
              </a>
            </div>
            <div className="admin-content">{children}</div>
          </div>
        </div>
      </div>
    </AuthReadyContext.Provider>
  );
}
