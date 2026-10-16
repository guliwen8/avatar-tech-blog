"use client";

import { useMemo, useState } from "react";
import type { PostMeta } from "@/lib/posts";

// 自动封面生成：根据分类名选一套鲜艳渐变色，让没配图的文章也有炫酷大字封面
const GRADIENTS = [
  "linear-gradient(135deg, #2f8fd8 0%, #7b4bff 100%)",
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

// 单张文章卡片：封面始终叠加大标题文字（像零度那种大字封面）
function Card({ post }: { post: PostMeta }) {
  const bg = gradientFor(post.category || post.title);
  return (
    <a href={`/posts/${post.slug}`} className="post-card">
      <div className="post-cover" style={{ background: bg }}>
        <span className="cover-cat">{post.category}</span>
        {post.cover && (
          <img src={post.cover} alt={post.title} className="cover-img" />
        )}
        {/* 封面上叠加的大标题文字 —— 这是视觉冲击的关键 */}
        <div className={`cover-title ${post.cover ? "has-img" : ""}`}>
          {post.title}
        </div>
        {/* 封面左下角作者头像 */}
        <span className="cover-avatar" aria-hidden>阿</span>
      </div>
      <div className="body">
        <h2>{post.title}</h2>
        <div className="foot">
          <span className="cal">📅</span>
          <span>{post.date}</span>
        </div>
      </div>
    </a>
  );
}

// 网格文章列表 + 搜索（搜索框在右侧栏，通过事件联动）
export function PostList({ posts }: { posts: PostMeta[] }) {
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

  // 分类统计（给侧边栏用）
  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of posts) map.set(p.category, (map.get(p.category) ?? 0) + 1);
    return Array.from(map.entries());
  }, [posts]);

  return (
    <div className="layout">
      {/* 左侧：文章网格 */}
      <div className="post-grid">
        {filtered.length === 0 ? (
          <p className="empty">没有找到匹配的文章 🤔</p>
        ) : (
          filtered.map((post) => <Card key={post.slug} post={post} />)
        )}
      </div>

      {/* 右侧：侧边栏 */}
      <aside className="sidebar">
        <div className="side-search">
          <input
            placeholder="🔍 搜索文章…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        <div className="side-card vip">
          <h3>⭐ 加入 VIP 会员</h3>
          <p>解锁全部教程资源，一对一答疑</p>
          <span className="btn">立即了解</span>
        </div>

        <div className="side-card tool">
          <h3>🚀 推荐工具</h3>
          <p>高速下载 · 效率神器</p>
          <span className="btn">立即获取</span>
        </div>

        <div className="side-block">
          <h4>🕐 最近文章</h4>
          <div className="recent-list">
            {posts.slice(0, 5).map((p) => (
              <a key={p.slug} href={`/posts/${p.slug}`} className="recent-item">
                <span className="recent-title">{p.title}</span>
                <span className="recent-date">{p.date}</span>
              </a>
            ))}
          </div>
        </div>

        <div className="side-block">
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
