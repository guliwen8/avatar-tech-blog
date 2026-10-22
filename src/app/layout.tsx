import { currentMember } from "@/server/member-session";
import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";
import { publicNavigation } from "@/lib/navigation";
import "./public.css";
import { listModules, getSettings } from "@/server/repo";

export const dynamic = "force-dynamic";

const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || "https://blog.zgyun.com.cn";

export const metadata: Metadata = {
  // 社交平台要求 og:image 是绝对地址，必须提供 metadataBase。
  metadataBase: new URL(SITE_URL),
  title: "阿凡达的技术博客",
  description: "分享技术教程、折腾笔记与踩坑经验",
  openGraph: {
    type: "website",
    siteName: "阿凡达的技术博客",
    locale: "zh_CN",
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image" },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 从数据库读取导航菜单和站点信息
  const reader = await currentMember();
  const navItems = listModules("nav");
  const settings = getSettings();
  const siteName = settings.siteName || "阿凡达博客";
  const siteSub = settings.siteSub || "技术折腾笔记";

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 在页面渲染前就读取本地保存的主题，避免深色模式闪烁 */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t){document.documentElement.setAttribute('data-theme',t);}else{document.documentElement.setAttribute('data-theme','light');}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          跳到正文
        </a>
        <SiteHeader
          readerName={reader?.username}
          name={siteName}
          subtitle={siteSub}
          items={publicNavigation(navItems)}
        />
        <main id="main-content">{children}</main>
        <footer className="site-footer">
          <div className="footer-inner">
            <a href="/" className="footer-brand">
              {siteName}
            </a>
            <p>{settings.siteDesc || "分享技术教程、折腾笔记与踩坑经验"}</p>
            <nav aria-label="页脚导航">
              <a href="/categories">全部分类</a>
              <a href="/about">关于本站</a>
              <a href="/consult">联系与咨询</a>
              <a href="/terms">服务说明</a>
              <a href="/privacy">隐私说明</a>
            </nav>
            <small>
              © {new Date().getFullYear()} {siteName} · Powered by Next.js
            </small>
          </div>
        </footer>
      </body>
    </html>
  );
}
