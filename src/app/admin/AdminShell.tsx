"use client";

import { useEffect, useState } from "react";
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

// 后台外壳：未登录显示登录页，已登录显示左菜单 + 工作区
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

  useEffect(() => {
    checkAuth().then(setAuthed);
  }, []);

  async function doLogin(e: React.FormEvent) {
    e.preventDefault();
    if (await login(user, pwd)) {
      setAuthed(true);
      setErr("");
    } else {
      setErr("用户名或密码错误，请重试");
    }
  }

  // 加载中
  if (authed === null) {
    return <div className="admin-root" />;
  }

  // 登录页
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
            <button type="submit">登录</button>
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

  // 后台主界面
  return (
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
  );
}
