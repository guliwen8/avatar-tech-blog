import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPostBySlug, getAllPostsMeta } from "@/lib/posts";
import { incrementViews, listAds } from "@/server/repo";
import { BlogSidebar } from "@/components/BlogSidebar";
import { PostCard } from "@/components/PostCard";
import { Icon } from "@/components/Icon";
export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(decodeURIComponent(slug));
  return post
    ? { title: `${post.title} · 阿凡达博客`, description: post.description }
    : { title: "文章未找到" };
}
export default async function PostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const realSlug = decodeURIComponent(slug);
  const post = await getPostBySlug(realSlug);
  if (!post) notFound();
  try {
    incrementViews(realSlug);
  } catch {}
  const posts = getAllPostsMeta();
  const related = posts
    .filter((p) => p.slug !== realSlug && p.category === post.category)
    .slice(0, 2);
  return (
    <div className="content-layout article-layout">
      <div>
        <div className="breadcrumb">
          <a href="/">首页</a>
          <span>/</span>
          <a href={`/categories/${encodeURIComponent(post.category)}`}>
            {post.category}
          </a>
          <span>/</span>正文
        </div>
        <article className="article article-detail">
          <header>
            <a
              className="entry-category"
              href={`/categories/${encodeURIComponent(post.category)}`}
            >
              {post.category}
            </a>
            <h1>
              {post.isVip && (
                <span className="article-vip">
                  <Icon name="crown" size={16} /> VIP
                </span>
              )}
              {post.title}
            </h1>
            <div className="article-meta">
              <time dateTime={post.rawDate}>{post.date}</time>
              <span>{post.readingTime}</span>
              <span>
                <Icon name="eye" size={16} />
                {post.views} 阅读
              </span>
            </div>
            {post.description && (
              <p className="article-summary">{post.description}</p>
            )}
          </header>
          <div
            className="prose"
            dangerouslySetInnerHTML={{ __html: post.contentHtml }}
          />
          <footer className="article-footer">
            <div className="tag-cloud">
              {post.tags.map((t) => (
                <a href={`/search?q=${encodeURIComponent(t)}`} key={t}>
                  # {t}
                </a>
              ))}
            </div>
            <p>
              有疑问，或想进一步交流？
              <a href="/consult">
                联系阿凡达 <Icon name="arrow" size={15} />
              </a>
            </p>
          </footer>
        </article>
        {related.length > 0 && (
          <section className="related-posts">
            <h2>你可能还感兴趣</h2>
            <div className="post-grid">
              {related.map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
            </div>
          </section>
        )}
      </div>
      <BlogSidebar posts={posts} ads={listAds(true)} />
    </div>
  );
}
