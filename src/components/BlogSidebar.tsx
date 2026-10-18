import type { ReactNode } from "react";
import { SidebarAd } from "./SidebarAd";
import type { PostMeta } from "@/lib/posts";
import { Icon } from "./Icon";
export interface AdItem {
  id: string;
  title: string;
  image: string;
  link: string;
}
export function BlogSidebar({
  posts,
  ads = [],
  filters,
}: {
  posts: PostMeta[];
  ads?: AdItem[];
  filters?: ReactNode;
}) {
  const tags = Array.from(new Set(posts.flatMap((p) => p.tags))).slice(0, 16);
  return (
    <aside className="sidebar" aria-label="搜索、分类与推荐内容">
      {filters}
      <a href="/vip" className="member-promo">
        <Icon name="crown" size={27} />
        <h3>阿凡达会员服务</h3>
        <p>深度内容 · 实战教程 · 人工咨询</p>
        <span>
          了解会员方案 <Icon name="arrow" size={16} />
        </span>
      </a>
      {ads.map((ad) => (
        <SidebarAd key={ad.id} ad={ad} />
      ))}
      <section className="side-box">
        <h3>近期文章</h3>
        <ol className="recent-posts">
          {posts.slice(0, 5).map((p, i) => (
            <li key={p.slug}>
              <span className="recent-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <a href={`/posts/${encodeURIComponent(p.slug)}`}>{p.title}</a>
                <time dateTime={p.rawDate}>{p.date}</time>
              </div>
            </li>
          ))}
        </ol>
      </section>
      {tags.length > 0 && (
        <section className="side-box">
          <h3>标签</h3>
          <div className="tag-cloud">
            {tags.map((t) => (
              <a key={t} href={`/search?q=${encodeURIComponent(t)}`}>
                {t}
              </a>
            ))}
          </div>
        </section>
      )}
    </aside>
  );
}
