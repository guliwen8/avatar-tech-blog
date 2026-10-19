import { getAllPostsMeta } from "@/lib/posts";
import { BlogSidebar } from "@/components/BlogSidebar";
export const dynamic = "force-dynamic";
export const metadata = { title: "全部标签 · 阿凡达博客" };
export default function TagsPage() {
  const posts = getAllPostsMeta();
  const counts = new Map<string, number>();
  for (const post of posts) for (const tag of new Set(post.tags)) counts.set(tag, (counts.get(tag) || 0) + 1);
  const tags = [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"));
  return <div className="content-layout"><section className="directory">
    <div className="breadcrumb"><a href="/">首页</a><span>/</span>全部标签</div>
    <h1>全部标签</h1><p className="page-intro">按关键词发现相关内容，每篇文章在同一标签下只计一次。</p>
    <div className="tag-cloud">{tags.map(([tag, count]) => <a key={tag} href={`/tags/${encodeURIComponent(tag)}`}>{tag} · {count}</a>)}</div>
    {!tags.length && <p>暂时还没有标签。</p>}
  </section><BlogSidebar posts={posts} /></div>;
}
