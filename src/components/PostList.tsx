"use client";

import { useMemo, useState } from "react";
import type { PostMeta } from "@/lib/posts";

// 带实时搜索的文章列表（首页用）
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

  return (
    <>
      <input
        className="search-box"
        placeholder="🔍 搜索文章标题、分类、标签…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {filtered.length === 0 ? (
        <p className="empty">没有找到匹配的文章 🤔</p>
      ) : (
        <div className="post-list">
          {filtered.map((post) => (
            <a key={post.slug} href={`/posts/${post.slug}`} className="post-card">
              <div className="meta">
                <span className="badge">{post.category}</span>
                <span>{post.date}</span>
                <span>·</span>
                <span>{post.readingTime}</span>
              </div>
              <h2>{post.title}</h2>
              <p>{post.description}</p>
            </a>
          ))}
        </div>
      )}
    </>
  );
}
