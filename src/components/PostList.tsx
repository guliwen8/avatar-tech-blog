"use client";
import { useEffect, useState, type ReactNode } from "react";
import type { PostMeta } from "@/lib/posts";
import { PostCard } from "./PostCard";
import { BlogSidebar, type AdItem } from "./BlogSidebar";
import { Icon } from "./Icon";
import { readListState, listStateUrl } from "@/lib/discovery";
const PAGE_SIZE = 12;
export function PostList({
  posts,
  ads = [],
  title = "最新文章",
  description = "",
  initialQuery = "",
  allPosts = posts,
  tabs,
  serverSearch = false,
}: {
  posts: PostMeta[];
  ads?: AdItem[];
  title?: string;
  description?: string;
  initialQuery?: string;
  allPosts?: PostMeta[];
  tabs?: ReactNode;
  serverSearch?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [page, setPage] = useState(1);
  useEffect(() => {
    function restore() {
      const state = readListState(new URLSearchParams(window.location.search));
      setQuery(serverSearch ? initialQuery : state.query);
      setPage(state.page);
    }
    restore();
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, [initialQuery, serverSearch, posts]);
  function update(page: number) {
    setPage(page);
    window.history.pushState(
      null,
      "",
      listStateUrl(window.location.href, {
        query: serverSearch ? initialQuery : "",
        category: "全部",
        page,
      }),
    );
  }
  const filtered = posts;
  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  const currentPage = Math.min(page, Math.max(1, pages));
  return (
    <div className="list-layout">
      <section className="list-main" aria-label={title}>
        <div className="list-head">
          <div>
            <h1>{title}</h1>
            {description && <p>{description}</p>}
          </div>
          <span className="result-count" aria-live="polite">
            {filtered.length} 篇内容
          </span>
        </div>
        {tabs}
        {filtered.length ? (
          <div className="post-grid">
            {filtered
              .slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
              .map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
          </div>
        ) : (
          <div className="catalog-empty">
            <Icon name="book" size={34} />
            <h2>
              {posts.length || serverSearch
                ? "没有找到匹配的内容"
                : "这个栏目还没有内容"}
            </h2>
            <p>
              {posts.length || serverSearch
                ? "试试其他关键词。"
                : "新的内容发布后会显示在这里。"}
            </p>
            {posts.length || serverSearch ? (
              <button
                onClick={() => {
                  if (serverSearch) window.location.assign("/search");
                  else update(1);
                }}
              >
                清除筛选
              </button>
            ) : (
              <a href="/">
                浏览全部文章 <Icon name="arrow" size={16} />
              </a>
            )}
          </div>
        )}
        {!filtered.length && allPosts.length > 0 && (
          <section className="empty-recommendations" aria-label="近期内容推荐">
            <h2>先看看这些文章</h2>
            <div className="post-grid">
              {allPosts.slice(0, 3).map((post) => (
                <PostCard key={post.slug} post={post} />
              ))}
            </div>
          </section>
        )}
        {pages > 1 && (
          <nav className="pagination" aria-label="内容分页">
            {Array.from({ length: pages }, (_, i) => (
              <button
                key={i}
                aria-current={currentPage === i + 1 ? "page" : undefined}
                onClick={() => {
                  update(i + 1);
                  document
                    .querySelector(".list-head")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
              >
                {i + 1}
              </button>
            ))}
          </nav>
        )}
      </section>
      <BlogSidebar
        compact={!filtered.length}
        posts={allPosts}
        ads={ads}
        filters={
          <section className="catalog-filters" aria-label="全站文章搜索">
            <div className="cat-box">
              <form action="/search" role="search">
                <div className="catalog-search">
                  <button
                    type="submit"
                    className="catalog-search-submit"
                    aria-label="提交全站搜索"
                  >
                    <Icon name="search" size={16} />
                  </button>
                  <input
                    name="q"
                    maxLength={200}
                    aria-label="搜索全部文章"
                    placeholder="搜索文章…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                  />
                </div>
              </form>
            </div>
          </section>
        }
      />
    </div>
  );
}
