"use client";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
export function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    setTheme(
      document.documentElement.getAttribute("data-theme") === "dark"
        ? "dark"
        : "light",
    );
  }, []);
  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
  }
  const label = theme === "dark" ? "切换浅色模式" : "切换深色模式";
  return (
    <button
      className="theme-toggle"
      onClick={toggle}
      aria-label={label}
      title={label}
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} />
    </button>
  );
}
