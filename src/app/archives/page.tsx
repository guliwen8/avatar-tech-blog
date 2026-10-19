import { getAllPostsMeta } from "@/lib/posts";
import { BlogSidebar } from "@/components/BlogSidebar";
export const dynamic = "force-dynamic";
export const metadata = { title: "文章归档 · 阿凡达博客" };
export default function ArchivesPage() {
  const posts = getAllPostsMeta();
  const groups = new Map<string, typeof posts>();
  for (const post of posts) {
    const date = new Date(post.rawDate);
    const month = Number.isNaN(date.getTime()) ? "日期待整理" : `${date.getUTCFullYear()}年${String(date.getUTCMonth() + 1).padStart(2, "0")}月`;
    groups.set(month, [...(groups.get(month) || []), post]);
  }
  return <div className="content-layout"><section className="directory">
    <div className="breadcrumb"><a href="/">首页</a><span>/</span>文章归档</div>
    <h1>文章归档</h1><p className="page-intro">共 {posts.length} 篇已发布内容，按月份回顾更新。</p>
    {[...groups].map(([month, entries]) => <section className="archive-month" key={month}><h2>{month} <small>· {entries.length} 篇</small></h2><ul>{entries.map(post => <li key={post.slug}><time dateTime={post.rawDate}>{post.date}</time><a href={`/posts/${encodeURIComponent(post.slug)}`}>{post.title}</a><span>{post.category}</span></li>)}</ul></section>)}
    {!posts.length && <p>暂时还没有已发布的内容。</p>}
  </section><BlogSidebar posts={posts} /></div>;
}
