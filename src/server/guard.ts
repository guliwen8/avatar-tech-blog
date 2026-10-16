import { NextResponse } from "next/server";
import { isAuthed } from "./auth";

// 包装需要登录才能调用的 API 处理函数
export async function requireAuth(): Promise<NextResponse | null> {
  if (!(await isAuthed())) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }
  return null;
}

// slug 生成（支持中文）
export function toSlug(s: string): string {
  return (
    s
      .trim()
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5]+/g, "-")
      .replace(/^-+|-+$/g, "") || "post-" + Date.now()
  );
}
