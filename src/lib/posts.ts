// 前台数据源：从 SQLite 数据库读取（替代原来的 Markdown 文件）。
// 保留 Markdown -> HTML 的渲染能力。
import readingTime from "reading-time";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";
import { listPosts, getPost, type Post as DBPost } from "@/server/repo";

export interface PostMeta {
  slug: string;
  title: string;
  date: string; // 显示用：2026年10月16日
  rawDate: string;
  description: string;
  category: string;
  tags: string[];
  cover?: string;
  readingTime: string;
  isVip: boolean;
  views: number;
}

export interface Post extends PostMeta {
  contentHtml: string;
}

function formatDate(raw: string): string {
  if (!raw) return "";
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw;
  return `${d.getUTCFullYear()}年${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
}

function toMeta(p: DBPost): PostMeta {
  return {
    slug: p.slug,
    title: p.title,
    date: formatDate(p.date),
    rawDate: p.date,
    description: p.description,
    category: p.category || "未分类",
    tags: p.tags,
    cover: p.cover || undefined,
    readingTime:
      Math.max(1, Math.round(readingTime(p.content).minutes)) + " 分钟阅读",
    isVip: p.is_vip,
    views: p.views,
  };
}

// 已发布文章的元信息，按日期从新到旧
export function getAllPostsMeta(): PostMeta[] {
  return listPosts(true).map(toMeta);
}

export function getAllCategories(): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const p of getAllPostsMeta()) {
    map.set(p.category, (map.get(p.category) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
}

export function getAllSlugs(): string[] {
  return listPosts(true).map((p) => p.slug);
}

export async function getPostBySlug(slug: string): Promise<Post | null> {
  const p = getPost(slug);
  if (!p || !p.published) return null;

  const processed = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype)
    .use(rehypeHighlight)
    .use(rehypeStringify)
    .process(p.content);

  return { ...toMeta(p), contentHtml: processed.toString() };
}
