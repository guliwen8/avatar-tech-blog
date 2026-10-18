"use client";
import { useMemo, useState, type ReactNode } from "react";
import type { PostMeta } from "@/lib/posts";
import { searchPosts } from "@/lib/catalog";
import { PostCard } from "./PostCard";
import { BlogSidebar, type AdItem } from "./BlogSidebar";
import { Icon } from "./Icon";
const PAGE_SIZE = 12;
export function PostList({
  posts,
  ads = [],
  title = "最新文章",
  description = "",
  initialQuery = "",
  allPosts = posts,
  tabs,
}: {
  posts: PostMeta[];
  ads?: AdItem[];
  title?: string;
  description?: string;
  initialQuery?: string;
  allPosts?: PostMeta[];
  tabs?: ReactNode;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState("全部");
  const [page, setPage] = useState(1);
  const categories = useMemo(() => {
    const m = new Map<string, number>();
    posts.forEach((p) => m.set(p.category, (m.get(p.category) || 0) + 1));
    return [...m.entries()];
  }, [posts]);
  const filtered = useMemo(
    () =>
      searchPosts(posts, query).filter(
        (p) => category === "全部" || p.category === category,
      ),
    [posts, query, category],
  );
  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  return (
    <div className="list-layout">
      <section className="list-main" aria-label={title}>
        <div className="list-head">
          <div>
            <h1>{category === "全部" ? title : category}</h1>
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
              .slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)
              .map((p) => (
                <PostCard key={p.slug} post={p} />
              ))}
          </div>
        ) : (
          <div className="catalog-empty">
            <Icon name="book" size={34} />
            <h2>
              {posts.length ? "没有找到匹配的内容" : "这个栏目还没有内容"}
            </h2>
            <p>
              {posts.length
                ? "试试其他关键词或分类。"
                : "新的内容发布后会显示在这里。"}
            </p>
            {posts.length ? (
              <button
                onClick={() => {
                  setQuery("");
                  setCategory("全部");
                  setPage(1);
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
        {pages > 1 && (
          <nav className="pagination" aria-label="内容分页">
            {Array.from({ length: pages }, (_, i) => (
              <button
                key={i}
                aria-current={page === i + 1 ? "page" : undefined}
                onClick={() => {
                  setPage(i + 1);
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
        posts={allPosts}
        ads={ads}
        filters={
          <section className="catalog-filters" aria-label="搜索与分类">
            <div className="cat-box">
              <h2>分类</h2>
              <ul className="cat-nav">
                {[["全部", posts.length], ...categories].map(
                  ([name, count]) => (
                    <li key={name}>
                      <button
                        aria-pressed={category === name}
                        className={category === name ? "active" : ""}
                        onClick={() => {
                          setCategory(String(name));
                          setPage(1);
                        }}
                      >
                        <span>{name}</span>
                        <span className="cnt">{count}</span>
                      </button>
                    </li>
                  ),
                )}
              </ul>
              <label className="catalog-search">
                <Icon name="search" size={16} />
                <input
                  aria-label="搜索当前栏目"
                  placeholder="搜索文章…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setPage(1);
                  }}
                />
              </label>
              <a className="all-categories" href="/categories">
                全部分类 <Icon name="arrow" size={14} />
              </a>
            </div>
          </section>
        }
      />
    </div>
  );
}
