import { NextRequest, NextResponse } from "next/server";
import { listPosts, upsertPost, deletePost, type Post } from "@/server/repo";
import { requireAuth, toSlug } from "@/server/guard";

export const dynamic = "force-dynamic";

// 列出所有文章（后台用，含草稿）
export async function GET() {
  const guard = await requireAuth();
  if (guard) return guard;
  return NextResponse.json(listPosts(false));
}

// 新增 / 更新文章
export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;

  const body = (await req.json()) as Partial<Post>;
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  }
  const post: Post = {
    slug: body.slug || toSlug(body.title),
    title: body.title,
    date: body.date || new Date().toISOString().slice(0, 10),
    category: body.category || "未分类",
    tags: body.tags || [],
    description: body.description || "",
    cover: body.cover || "",
    content: body.content || "",
    published: body.published ?? true,
    is_vip: body.is_vip ?? false,
    views: body.views ?? 0,
  };
  upsertPost(post);
  return NextResponse.json({ ok: true, slug: post.slug });
}

// 删除文章
export async function DELETE(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "缺少 slug" }, { status: 400 });
  deletePost(slug);
  return NextResponse.json({ ok: true });
}
