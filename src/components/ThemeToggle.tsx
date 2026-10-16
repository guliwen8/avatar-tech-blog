"use client";

import { useEffect, useState } from "react";

// 深色/浅色模式切换按钮，选择会保存在浏览器 localStorage 里
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const current =
      (document.documentElement.getAttribute("data-theme") as
        | "light"
        | "dark") || "light";
    setTheme(current);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }

  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label="切换深色模式"
      title="切换深色模式"
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
