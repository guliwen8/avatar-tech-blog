"use client";

import { useState, useCallback } from "react";

// 简单的操作成功提示
export function useToast() {
  const [msg, setMsg] = useState("");

  const show = useCallback((text: string) => {
    setMsg(text);
    setTimeout(() => setMsg(""), 2200);
  }, []);

  const node = msg ? <div className="toast">✓ {msg}</div> : null;

  return { show, node };
}
