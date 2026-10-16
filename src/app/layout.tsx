import type { Metadata } from "next";
import "./globals.css";
import { ThemeToggle } from "@/components/ThemeToggle";
import { listModules, getSettings } from "@/server/repo";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "阿凡达的技术博客",
  description: "分享技术教程、折腾笔记与踩坑经验",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 从数据库读取导航菜单和站点信息
  const navItems = listModules("nav").filter((m) => m.enabled);
  const settings = getSettings();
  const siteName = settings.siteName || "阿凡达博客";
  const siteSub = settings.siteSub || "技术折腾笔记";

  // 站点名称：末两字高亮
  const nameMain = siteName.length > 2 ? siteName.slice(0, -2) : siteName;
  const nameHi = siteName.length > 2 ? siteName.slice(-2) : "";

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 在页面渲染前就读取本地保存的主题，避免深色模式闪烁 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t){document.documentElement.setAttribute('data-theme',t);}else if(window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <header className="site-header">
          <div className="inner">
            <span className="header-search" title="搜索">🔍</span>
            <a href="/" className="site-title">
              {nameMain}
              <b>{nameHi}</b>
              <span className="sub">{siteSub}</span>
            </a>
            <nav className="nav">
              {navItems.map((m) => (
                <a
                  key={m.id}
                  href={m.value}
                  style={
                    m.value === "/vip"
                      ? { color: "var(--primary)", fontWeight: 600 }
                      : undefined
                  }
                >
                  {m.value === "/vip" ? "⭐ " : ""}
                  {m.label}
                </a>
              ))}
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          © {new Date().getFullYear()} {siteName} · Powered by Next.js
        </footer>
      </body>
    </html>
  );
}
