import { NextResponse } from "next/server";
import { isAuthed } from "./auth";

// 包装需要登录才能调用的 API 处理函数
export async function requireAuth(): Promise<NextResponse | null> {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  return null;
}

// slug 生成：只保留英文、数字、连字符（去掉中文等特殊字符，保证网址安全）。
// 纯中文标题会得到空串，此时用 post-时间戳 作为 slug。
export function toSlug(s: string): string {
  const cleaned = s
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, "-") // 非 [a-z0-9_] 一律转连字符（含中文）
    .replace(/^-+|-+$/g, "");
  return cleaned || "post-" + Date.now();
}
