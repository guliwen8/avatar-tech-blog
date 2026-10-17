import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPostBySlug } from "@/lib/posts";
import { incrementViews } from "@/server/repo";

// 文章来自数据库，动态渲染
export const dynamic = "force-dynamic";

// 每篇文章的网页标题
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(decodeURIComponent(slug));
  if (!post) return { title: "文章未找到" };
  return {
    title: `${post.title} · 阿凡达的技术博客`,
    description: post.description,
  };
}

// 文章详情页
export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const realSlug = decodeURIComponent(slug);
  const post = await getPostBySlug(realSlug);
  if (!post) notFound();

  // 浏览量 +1
  try {
    incrementViews(realSlug);
  } catch {}

  return (
    <div className="article-wrap">
      <article className="article">
        <a href="/" className="back">
          ← 返回首页
        </a>
        <h1>
          {post.isVip && <span className="vip-tag-inline">👑 VIP</span>}
          {post.title}
        </h1>
        <div className="meta">
          <span className="cat">{post.category}</span>
          <span>📅 {post.date}</span>
          <span>· {post.readingTime}</span>
          <span>· 👁 {post.views} 阅读</span>
        </div>
        <div
          className="prose"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />
      </article>
    </div>
  );
}
