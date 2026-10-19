"use client";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "./Icon";
import { ThemeToggle } from "./ThemeToggle";
export interface NavItem {
  label: string;
  value: string;
}
export function SiteHeader({
  readerName,
  name,
  subtitle,
  items,
}: {
  readerName?: string;
  name: string;
  subtitle: string;
  items: NavItem[];
}) {
  const pathname = usePathname();
  const [menu, setMenu] = useState(false);
  if (pathname === "/admin" || pathname.startsWith("/admin/")) return null;
  return (
    <header className="site-header">
      <div className="inner">
        <details className="header-search">
          <summary aria-label="打开站内搜索">
            <Icon name="search" />
          </summary>
          <form action="/search" className="header-search-form">
            <label htmlFor="site-search">搜索文章</label>
            <div>
              <input
                id="site-search"
                name="q"
                placeholder="输入标题、分类或关键词"
                required
              />
              <button aria-label="搜索">
                <Icon name="arrow" />
              </button>
            </div>
          </form>
        </details>
        <a href="/" className="site-title">
          {name.slice(0, -2)}
          <b>{name.slice(-2)}</b>
          <span className="sub">{subtitle}</span>
        </a>
        <button
          className="mobile-menu"
          aria-label={menu ? "收起导航" : "展开导航"}
          aria-expanded={menu}
          aria-controls="primary-nav"
          onClick={() => setMenu(!menu)}
        >
          <Icon name={menu ? "close" : "menu"} />
        </button>
        <nav
          id="primary-nav"
          className={`nav ${menu ? "is-open" : ""}`}
          aria-label="主导航"
        >
          {items.map((m, i) => (
            <a
              key={`${m.value}-${i}`}
              href={m.value}
              aria-current={pathname === m.value ? "page" : undefined}
              onClick={() => setMenu(false)}
            >
              {m.label}
            </a>
          ))}
          <a
            className="reader-account-link"
            href={readerName ? "/account" : "/login"}
          >
            {readerName ? "我的账号" : "登录 / 注册"}
          </a>
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}
