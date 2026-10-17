"use client";

import { useMemo, useState } from "react";
import type { PostMeta } from "@/lib/posts";

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

// 阅读量格式化（1024 -> 1k）
function fmtViews(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + "w";
  if (n >= 1000) return (n / 1000).toFixed(1) + "k";
  return String(n);
}

function Card({ post }: { post: PostMeta }) {
  return (
    <div className="post-card">
      <div className="masonry-inner">
        <a
          href={`/posts/${encodeURIComponent(post.slug)}`}
          className="entry-thumbnail"
          style={post.cover ? undefined : { background: gradientFor(post.category || post.title) }}
        >
          {post.cover ? (
            <img src={post.cover} alt={post.title} />
          ) : (
            <span className="thumb-text">{post.title}</span>
          )}
          {post.isVip && <span className="vip-badge">👑 VIP</span>}
        </a>
        <h2 className="entry-title">
          <a href={`/posts/${encodeURIComponent(post.slug)}`}>{post.title}</a>
        </h2>
        <div className="entry-meta">
          <span className="cat">{post.category}</span>
          <span className="dot">·</span>
          <span>📅 {post.date}</span>
          <span className="views">👁 {fmtViews(post.views)}</span>
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
  const [activeCat, setActiveCat] = useState("全部");

  // 分类列表（含"全部"）
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of posts) map.set(p.category, (map.get(p.category) ?? 0) + 1);
    return [["全部", posts.length] as [string, number], ...Array.from(map.entries())];
  }, [posts]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return posts.filter((p) => {
      const matchCat = activeCat === "全部" || p.category === activeCat;
      const matchQ =
        !q ||
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q));
      return matchCat && matchQ;
    });
  }, [query, activeCat, posts]);

  return (
    <div className="list-layout">
      {/* 左侧分类栏（零度结构）*/}
      <aside className="cat-sidebar">
        <div className="cat-box">
          <h4>分类</h4>
          <ul className="cat-nav">
            {categories.map(([name, count]) => (
              <li key={name}>
                <button
                  className={activeCat === name ? "active" : ""}
                  onClick={() => setActiveCat(name)}
                >
                  <span>{name}</span>
                  <span className="cnt">{count}</span>
                </button>
              </li>
            ))}
          </ul>
          <input
            className="cat-search"
            placeholder="🔍 搜索文章…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </aside>

      {/* 中间文章网格 */}
      <div className="list-main">
        <div className="list-head">
          <h1>{activeCat === "全部" ? "全部内容" : activeCat}</h1>
          <p>共 {filtered.length} 篇</p>
        </div>
        <div className="post-grid">
          {filtered.length === 0 ? (
            <p className="empty">没有找到匹配的文章 🤔</p>
          ) : (
            filtered.map((post) => <Card key={post.slug} post={post} />)
          )}
        </div>
      </div>

      {/* 右侧广告位 */}
      <aside className="sidebar">
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
      </aside>
    </div>
  );
}
