import type { Metadata } from "next";
import "./globals.css";
import { ThemeToggle } from "@/components/ThemeToggle";

export const metadata: Metadata = {
  title: "阿凡达的技术博客",
  description: "分享技术教程、折腾笔记与踩坑经验",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
              阿凡达<b>博客</b>
              <span className="sub">技术折腾笔记</span>
            </a>
            <nav className="nav">
              <a href="/">首页</a>
              <a href="/categories">分类</a>
              <a href="/categories">教程</a>
              <a href="/vip" style={{ color: "var(--primary)", fontWeight: 600 }}>
                ⭐ 会员
              </a>
              <a href="/about">关于</a>
              <ThemeToggle />
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          © {new Date().getFullYear()} 阿凡达的技术博客 · Powered by Next.js
        </footer>
      </body>
    </html>
  );
}
