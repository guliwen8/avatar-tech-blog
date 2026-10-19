"use client";
import { useEffect, useRef } from "react";
export function ArticleBody({ html }: { html: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const cleanups: (() => void)[] = [];
    root.querySelectorAll("pre").forEach((pre) => {
      const code = pre.querySelector("code");
      if (!code) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "code-copy";
      button.textContent = "复制代码";
      const copy = async (event: MouseEvent) => {
        event.preventDefault();
        event.stopPropagation();
        try {
          await navigator.clipboard.writeText(code.textContent || "");
          if (status.current) status.current.textContent = "代码已复制";
          button.textContent = "已复制";
        } catch {
          button.textContent = "复制失败";
          if (status.current)
            status.current.textContent = "复制失败，请选中代码手动复制";
        }
      };
      button.addEventListener("click", copy);
      pre.before(button);
      cleanups.push(() => {
        button.removeEventListener("click", copy);
        button.remove();
      });
    });
    return () => cleanups.forEach((cleanup) => cleanup());
  }, [html]);
  return (
    <>
      <div
        ref={ref}
        className="prose"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <p
        ref={status}
        className="copy-status"
        role="status"
        aria-live="polite"
      />
    </>
  );
}
