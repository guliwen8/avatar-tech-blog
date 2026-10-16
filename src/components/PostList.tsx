"use client";

import { useMemo, useState } from "react";
import type { PostMeta } from "@/lib/posts";

// 无图文章的自动渐变封面（按分类取色）
const GRADIENTS = [
  "linear-gradient(135deg, #24a5db 0%, #4f6bff 100%)",
  "linear-gradient(135deg, #f6416c 0%, #ff8c42 100%)",
  "linear-gradient(135deg, #11998e 0%, #38ef7d 100%)",
  "linear-gradient(135deg, #654ea3 0%, #eaafc8 100%)",
  "linear-gradient(135deg, #ff512f 0%, #dd2476 100%)",
  "linear-gradient(135deg, #1a2980 0%, #26d0ce 100%)",
];
function gradientFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return GRADIENTS[h % GRADIENTS.length];
}

// 单张卡片 —— 还原零度 gridzone 结构：缩略图 + 标题 + 日期meta
function Card({ post }: { post: PostMeta }) {
  return (
    <div className="post-card">
      <div className="masonry-inner">
        <a
          href={`/posts/${post.slug}`}
          className="entry-thumbnail"
          style={post.cover ? undefined : { background: gradientFor(post.category || post.title) }}
        >
          {post.cover ? (
            <img src={post.cover} alt={post.title} />
          ) : (
            <span className="thumb-text">{post.title}</span>
          )}
        </a>
        <h2 className="entry-title">
          <a href={`/posts/${post.slug}`}>{post.title}</a>
        </h2>
        <div className="entry-meta">
          <span className="cat">{post.category}</span>
          <span className="dot">·</span>
          <span>📅 {post.date}</span>
        </div>
      </div>
    </div>
  );
}

interface AdItem {
  id: string;
  title: string;
  image: string;
  link: string;
}

export function PostList({
  posts,
  ads = [],
}: {
  posts: PostMeta[];
  ads?: AdItem[];
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return posts;
    return posts.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [query, posts]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of posts) map.set(p.category, (map.get(p.category) ?? 0) + 1);
    return Array.from(map.entries());
  }, [posts]);

  return (
    <div className="layout">
      {/* 左侧文章网格 */}
      <div className="post-grid">
        {filtered.length === 0 ? (
          <p className="empty">没有找到匹配的文章 🤔</p>
        ) : (
          filtered.map((post) => <Card key={post.slug} post={post} />)
        )}
      </div>

      {/* 右侧栏 */}
      <aside className="sidebar">
        <div className="side-box">
          <input
            placeholder="🔍 搜索文章…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* 广告位：来自后台数据库，可在后台增删改 */}
        {ads.map((ad) =>
          ad.image ? (
            <a key={ad.id} href={ad.link} className="side-ad-img">
              <img src={ad.image} alt={ad.title} />
            </a>
          ) : (
            <a key={ad.id} href={ad.link} className="side-ad vip">
              <h3>{ad.title}</h3>
              <span className="btn">了解详情</span>
            </a>
          )
        )}

        <div className="side-box">
          <h4>🕐 最近文章</h4>
          {posts.slice(0, 5).map((p) => (
            <a key={p.slug} href={`/posts/${p.slug}`} className="recent-item">
              <span className="t">{p.title}</span>
              <span className="d">{p.date}</span>
            </a>
          ))}
        </div>

        <div className="side-box">
          <h4>📂 文章分类</h4>
          <div className="cat-list">
            {categories.map(([name, count]) => (
              <a key={name} href="/categories">
                <span>{name}</span>
                <span className="cnt">{count}</span>
              </a>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
