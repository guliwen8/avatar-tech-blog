import { normalizeEditorial, type EditorialData } from "@/lib/editorial";
import { sameOrigin } from "@/server/member-session";
import { getDB } from "@/server/db";
import { bindPostFiles, FileError } from "@/server/private-files";
import {
  validateDetailsForPublication,
  type ContentDetails,
} from "@/lib/content-details";
import { NextRequest, NextResponse } from "next/server";
import {
  getPost,
  listPosts,
  upsertPost,
  deletePost,
  type Post,
} from "@/server/repo";
import { requireAuth } from "@/server/guard";
import { ensurePostCover } from "@/server/cover-job";
import { gateMessage, qualityGate } from "@/lib/quality-gate";
import { slugify } from "@/lib/slug";

/** 用拼音生成可读 slug；同名的自动加 -2、-3。 */
function uniqueSlug(
  db: ReturnType<typeof getDB>,
  base: string,
): string {
  const root = base || "post-" + Date.now();
  let slug = root;
  let n = 2;
  while (db.prepare("SELECT 1 FROM posts WHERE slug=?").get(slug))
    slug = `${root}-${n++}`;
  return slug;
}

export const dynamic = "force-dynamic";

// 列出所有文章（后台用，含草稿）
export async function GET() {
  const guard = await requireAuth();
  if (guard) return guard;
  return NextResponse.json(listPosts(false), {
    headers: { "Cache-Control": "private, no-store" },
  });
}

// 新增 / 更新文章
export async function POST(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;

  const origin = sameOrigin(req);
  if (origin) return origin;
  const body = (await req.json()) as Partial<Post>;
  if (!body.title?.trim()) {
    return NextResponse.json({ error: "标题不能为空" }, { status: 400 });
  }
  let details: ContentDetails;
  let editorial: EditorialData;
  try {
    editorial = normalizeEditorial(
      body.editorial === undefined && body.slug
        ? getPost(body.slug)?.editorial
        : body.editorial,
    );
    details = validateDetailsForPublication(
      body.details === undefined && body.slug
        ? getPost(body.slug)?.details
        : body.details,
      body.published ?? true,
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "内容资料无效" },
      { status: 400 },
    );
  }
  const post: Post = {
    editorial,
    details,
    slug: body.slug || uniqueSlug(getDB(), slugify(body.title)),
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
  // 发布闸门：只拦「发布」，草稿保存不受影响。
  const report = qualityGate(post, { published: post.published });
  const forcePublish = (body as Record<string, unknown>).forcePublish === true;
  if (!report.pass && !forcePublish) {
    return NextResponse.json(
      { error: `发布检查未通过：${gateMessage(report)}`, gates: report.gates },
      { status: 400 },
    );
  }
  try {
    getDB().transaction(() => {
      bindPostFiles(getDB(), post.slug, post.details, post);
      upsertPost(post);
    })();
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof FileError ? error.message : "保存失败，请重试",
      },
      { status: error instanceof FileError ? error.status : 500 },
    );
  }
  // 没有封面时后台补一张，不阻塞保存响应；失败不影响本次保存结果。
  const coverPending = !post.cover;
  if (coverPending) {
    void ensurePostCover(post.slug).catch(() => {});
  }
  return NextResponse.json({ ok: true, slug: post.slug, coverPending });
}

// 删除文章
export async function DELETE(req: NextRequest) {
  const guard = await requireAuth();
  if (guard) return guard;
  const origin = sameOrigin(req);
  if (origin) return origin;
  const slug = new URL(req.url).searchParams.get("slug");
  if (!slug) return NextResponse.json({ error: "缺少 slug" }, { status: 400 });
  deletePost(slug);
  return NextResponse.json({ ok: true });
}
