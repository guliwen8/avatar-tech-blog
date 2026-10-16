import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getAllSlugs, getPostBySlug } from "@/lib/posts";

// 告诉 Next.js 要为哪些文章生成静态页面
export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

// 每篇文章的网页标题
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);
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
  const post = await getPostBySlug(slug);
  if (!post) notFound();

  return (
    <div className="article-wrap">
      <article className="article">
        <a href="/" className="back">
          ← 返回首页
        </a>
        <h1>{post.title}</h1>
        <div className="meta">
          <span className="cat">{post.category}</span>
          <span>📅 {post.date}</span>
          <span>· {post.readingTime}</span>
        </div>
        <div
          className="prose"
          dangerouslySetInnerHTML={{ __html: post.contentHtml }}
        />
      </article>
    </div>
  );
}
