import { currentMember } from "@/server/member-session";
import { ContentPanel } from "@/components/ContentPanel";
import { ArticleBody } from "@/components/ArticleBody";
import { selectChannel } from "@/lib/catalog";
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
  const reader = post.locked ? await currentMember() : null;
  try {
    if (!post.locked) incrementViews(realSlug);
  } catch {}
  const posts = getAllPostsMeta();
  const position = posts.findIndex((p) => p.slug === realSlug);
  const newer = position > 0 ? posts[position - 1] : undefined;
  const older = position >= 0 ? posts[position + 1] : undefined;
  const video = selectChannel([post], "videos").length > 0;
  const project = selectChannel([post], "projects").length > 0;
  const resource = selectChannel([post], "resources").length > 0;
  const media =
    video && !post.details?.videoUrl && !post.details?.sourceUrl
      ? post.resources.filter((link) => link.video)
      : [];
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
          {post.locked && (
            <section className="access-gate" aria-label="内容访问提示">
              <Icon name="crown" size={30} />
              <h2>
                {post.access === "login"
                  ? "登录后继续阅读"
                  : "此内容需要有效会员"}
              </h2>
              <p>
                {post.access === "login"
                  ? "注册或登录账号即可阅读正文与资料。"
                  : "登录后查看会员状态，或联系站长开通。"}
              </p>
              <a
                className="primary-button"
                href={
                  reader
                    ? "/account"
                    : `/login?redirect=${encodeURIComponent(`/posts/${post.slug}`)}`
                }
              >
                {reader ? "查看会员状态" : "登录账号"}
              </a>
              <a href={reader ? "/consult" : "/account"}>
                {reader ? "咨询开通" : "查看我的会员状态"}
              </a>
            </section>
          )}
          <ContentPanel post={post} />
          {post.toc.length > 0 && (
            <details className="article-toc" open>
              <summary>文章目录</summary>
              <nav aria-label="文章目录">
                <ol>
                  {post.toc.map((item) => (
                    <li key={item.id} data-depth={item.depth}>
                      <a href={`#${item.id}`}>{item.text}</a>
                    </li>
                  ))}
                </ol>
              </nav>
            </details>
          )}
          {media.length > 0 && (
            <section className="article-media" aria-label="视频播放">
              {media.map((link) => (
                <figure key={link.href}>
                  <video
                    controls
                    preload="none"
                    playsInline
                    poster={post.cover}
                  >
                    <source src={link.href} />
                    <a href={link.href}>打开视频文件</a>
                  </video>
                  <figcaption>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.text} · 打开原视频
                    </a>
                  </figcaption>
                </figure>
              ))}
            </section>
          )}
          <ArticleBody html={post.contentHtml} />
          {post.resources.length > 0 && (
            <section
              className="article-resources"
              aria-labelledby="resource-heading"
            >
              <h2 id="resource-heading">
                {project
                  ? "项目与资料"
                  : resource
                    ? "资源与下载链接"
                    : video
                      ? "视频与相关资料"
                      : "文中链接"}
              </h2>
              <p>整理自本文的外部链接，请以来源页面说明为准。</p>
              <ul>
                {post.resources.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span>{link.text}</span>
                      <small>{new URL(link.href).hostname}</small>
                      <Icon name="arrow" size={16} />
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <footer className="article-footer">
            <div className="tag-cloud">
              {post.tags.map((t) => (
                <a href={`/tags/${encodeURIComponent(t)}`} key={t}>
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
        {(newer || older) && (
          <nav className="article-neighbors" aria-label="继续阅读">
            {newer ? (
              <a href={`/posts/${encodeURIComponent(newer.slug)}`}>
                <small>较新一篇</small>
                <span>{newer.title}</span>
              </a>
            ) : (
              <span />
            )}
            {older && (
              <a href={`/posts/${encodeURIComponent(older.slug)}`}>
                <small>较早一篇</small>
                <span>{older.title}</span>
              </a>
            )}
          </nav>
        )}
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
