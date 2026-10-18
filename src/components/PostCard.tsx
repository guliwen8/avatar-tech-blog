"use client";
import { useState } from "react";
import type { PostMeta } from "@/lib/posts";
import { Icon } from "./Icon";
export function PostCard({ post }: { post: PostMeta }) {
  const [failed, setFailed] = useState(false);
  const href = `/posts/${encodeURIComponent(post.slug)}`;
  return (
    <article className="post-card">
      <div className="masonry-inner">
        <a href={href} className="entry-thumbnail" aria-label={post.title}>
          <span className="cover-fallback">
            <Icon name="book" size={36} />
            <span>{post.category}</span>
          </span>
          {post.cover && !failed && (
            <img
              className="cover-photo"
              src={post.cover}
              alt=""
              loading="lazy"
              onError={() => setFailed(true)}
            />
          )}
          {post.isVip && (
            <span className="vip-badge">
              <Icon name="crown" size={13} /> VIP
            </span>
          )}
        </a>
        <div className="entry-body">
          <a
            href={`/categories/${encodeURIComponent(post.category)}`}
            className="entry-category"
          >
            {post.category}
          </a>
          <h2 className="entry-title">
            <a href={href}>{post.title}</a>
          </h2>
          <p className="entry-excerpt">{post.description}</p>
          <div className="entry-meta">
            <time dateTime={post.rawDate}>{post.date}</time>
            <span className="views">
              <Icon name="eye" size={14} />
              {post.views.toLocaleString("zh-CN")}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
