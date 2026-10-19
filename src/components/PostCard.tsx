"use client";
import { useState } from "react";
import type { PostMeta } from "@/lib/posts";
import { safeCover } from "@/lib/reading";
import { contentKind, selectChannel } from "@/lib/catalog";
import { Icon } from "./Icon";
export function PostCard({ post }: { post: PostMeta }) {
  const [failed, setFailed] = useState(false);
  const kind = contentKind(post);
  const cover = safeCover(post.cover);
  const video = selectChannel([post], "videos").length > 0;
  const href = `/posts/${encodeURIComponent(post.slug)}`;
  return (
    <article className="post-card">
      <div className="masonry-inner">
        <a href={href} className="entry-thumbnail" aria-label={post.title}>
          <span className="cover-fallback">
            <Icon name={video ? "play" : "book"} size={36} />
            <span>{post.category}</span>
          </span>
          {cover && !failed && (
            <img
              className="cover-photo"
              src={cover}
              alt=""
              loading="lazy"
              onError={() => setFailed(true)}
            />
          )}
          {video && (
            <span className="video-badge">
              <Icon name="play" size={16} /> 视频
            </span>
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
          {kind !== "article" && (
            <div className="content-card-meta">
              <span>
                {kind === "video"
                  ? "视频"
                  : kind === "project"
                    ? "开源项目"
                    : "免费资源"}
              </span>
              {post.details?.duration && kind === "video" && (
                <span>{post.details.duration}</span>
              )}
              {post.details?.version && kind !== "video" && (
                <span>{post.details.version}</span>
              )}
              {post.details?.platform && kind === "resource" && (
                <span>{post.details.platform}</span>
              )}
            </div>
          )}
          {post.details?.access && post.details.access !== "public" && (
            <p className="access-label">
              {post.details.access === "login" ? "登录可读" : "会员可读"}
            </p>
          )}
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
