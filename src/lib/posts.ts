import fs from "fs";
import path from "path";
import matter from "gray-matter";
import readingTime from "reading-time";
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeHighlight from "rehype-highlight";
import rehypeStringify from "rehype-stringify";

// 所有文章的 Markdown 文件都放在这个目录里
const postsDirectory = path.join(process.cwd(), "content/posts");

// 一篇文章的元信息（不含正文）
export interface PostMeta {
  slug: string; // 文章的网址标识，来自文件名，例如 hello-world.md -> hello-world
  title: string; // 标题
  date: string; // 发布日期，例如 2026-10-16
  description: string; // 摘要，显示在列表页
  category: string; // 分类
  tags: string[]; // 标签
  cover?: string; // 封面图地址（可选）
  readingTime: string; // 预计阅读时间，自动计算
}

// 一篇完整文章 = 元信息 + 已转成 HTML 的正文
export interface Post extends PostMeta {
  contentHtml: string;
}

// 读取 content/posts 下所有 .md 文件名
function getPostFiles(): string[] {
  if (!fs.existsSync(postsDirectory)) return [];
  return fs.readdirSync(postsDirectory).filter((f) => f.endsWith(".md"));
}

// 把单个文件解析成元信息
function parseMeta(fileName: string): PostMeta {
  const slug = fileName.replace(/\.md$/, "");
  const fullPath = path.join(postsDirectory, fileName);
  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);

  return {
    slug,
    title: data.title ?? slug,
    date: data.date ? String(data.date) : "",
    description: data.description ?? "",
    category: data.category ?? "未分类",
    tags: Array.isArray(data.tags) ? data.tags : [],
    cover: data.cover ?? undefined,
    readingTime: Math.max(1, Math.round(readingTime(content).minutes)) + " 分钟阅读",
  };
}

// 获取所有文章元信息，按日期从新到旧排序（给首页/列表页用）
export function getAllPostsMeta(): PostMeta[] {
  return getPostFiles()
    .map(parseMeta)
    .sort((a, b) => (a.date < b.date ? 1 : -1));
}

// 获取所有分类及其文章数量
export function getAllCategories(): { name: string; count: number }[] {
  const map = new Map<string, number>();
  for (const post of getAllPostsMeta()) {
    map.set(post.category, (map.get(post.category) ?? 0) + 1);
  }
  return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
}

// 获取所有文章的 slug，供 Next.js 生成静态页面用
export function getAllSlugs(): string[] {
  return getPostFiles().map((f) => f.replace(/\.md$/, ""));
}

// 根据 slug 读取单篇完整文章，并把 Markdown 正文转成 HTML
export async function getPostBySlug(slug: string): Promise<Post | null> {
  const fullPath = path.join(postsDirectory, `${slug}.md`);
  if (!fs.existsSync(fullPath)) return null;

  const fileContents = fs.readFileSync(fullPath, "utf8");
  const { data, content } = matter(fileContents);

  const processed = await unified()
    .use(remarkParse) // 解析 Markdown
    .use(remarkGfm) // 支持表格、任务列表等 GitHub 风格语法
    .use(remarkRehype) // 转成 HTML 语法树
    .use(rehypeHighlight) // 代码块语法高亮
    .use(rehypeStringify) // 输出 HTML 字符串
    .process(content);

  const meta = parseMeta(`${slug}.md`);

  return {
    ...meta,
    contentHtml: processed.toString(),
  };
}
