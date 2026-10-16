"use client";

// ============================================================
// 后台演示版数据层 —— 目前用浏览器 localStorage 模拟数据库。
// 之后上群晖 NAS 时，把这里的读写换成真实的后端 API 调用即可，
// 界面和交互完全不用改。
// ============================================================

export interface AdminPost {
  slug: string;
  title: string;
  date: string; // 2026-10-16
  category: string;
  tags: string[];
  description: string;
  cover: string;
  content: string; // Markdown 正文
  published: boolean;
}

export interface SiteModule {
  id: string;
  type: "nav" | "sidebar";
  label: string; // 显示名
  value: string; // 内容/链接
  enabled: boolean;
}

// 会员套餐
export interface MemberPlan {
  id: string;
  name: string; // 套餐名，如「月度会员」
  price: number; // 价格（元）
  period: string; // 周期，如「/月」「/年」「永久」
  features: string[]; // 权益列表
  highlight: boolean; // 是否推荐（高亮）
  enabled: boolean;
}

// 广告位
export interface AdSlot {
  id: string;
  title: string; // 广告标题
  image: string; // 广告图地址
  link: string; // 点击跳转
  position: string; // 位置，如「侧边栏」
  enabled: boolean;
}

const POSTS_KEY = "avatar_admin_posts";
const MODULES_KEY = "avatar_admin_modules";
const PLANS_KEY = "avatar_admin_plans";
const ADS_KEY = "avatar_admin_ads";
const AUTH_KEY = "avatar_admin_auth";

// 演示用密码（上线接后端后换成真实登录）
export const DEMO_PASSWORD = "avatar2026";

// -------- 初始演示数据 --------
const seedPosts: AdminPost[] = [
  {
    slug: "hello-world",
    title: "第一篇文章：你好，世界",
    date: "2026-10-16",
    category: "随笔",
    tags: ["开始", "博客"],
    description: "欢迎来到我的技术博客！介绍一下这个博客以及怎么写新文章。",
    cover:
      "https://images.unsplash.com/photo-1534972195531-d756b9bfa9f2?w=800&q=80",
    content: "## 欢迎\n\n这是阿凡达的技术博客的第一篇文章。",
    published: true,
  },
  {
    slug: "deploy-to-synology-nas",
    title: "把博客部署到群晖 NAS（Docker 方式）",
    date: "2026-10-15",
    category: "教程",
    tags: ["群晖", "Docker", "部署"],
    description: "一步步把这个 Next.js 博客用 Docker 跑在你自己的群晖 NAS 上。",
    cover:
      "https://images.unsplash.com/photo-1591405351990-4726e331f141?w=800&q=80",
    content: "## 为什么用 NAS 部署？\n\n大陆访问更稳定，数据在自己手里。",
    published: true,
  },
  {
    slug: "markdown-guide",
    title: "Markdown 写作速查表",
    date: "2026-10-14",
    category: "教程",
    tags: ["Markdown", "写作"],
    description: "写博客文章常用的 Markdown 语法大全。",
    cover:
      "https://images.unsplash.com/photo-1517180102446-f3ece451e9d8?w=800&q=80",
    content: "## 标题\n\n用 ## 表示二级标题。",
    published: true,
  },
];

const seedModules: SiteModule[] = [
  { id: "nav-1", type: "nav", label: "首页", value: "/", enabled: true },
  { id: "nav-2", type: "nav", label: "分类", value: "/categories", enabled: true },
  { id: "nav-3", type: "nav", label: "教程", value: "/categories", enabled: true },
  { id: "nav-4", type: "nav", label: "关于", value: "/about", enabled: true },
  {
    id: "side-1",
    type: "sidebar",
    label: "加入阿凡达 VIP 会员",
    value: "解锁全部教程资源，一对一答疑",
    enabled: true,
  },
  {
    id: "side-2",
    type: "sidebar",
    label: "推荐工具",
    value: "高速下载 · 效率神器",
    enabled: true,
  },
];

// -------- 读写辅助 --------
function read<T>(key: string, seed: T): T {
  if (typeof window === "undefined") return seed;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      localStorage.setItem(key, JSON.stringify(seed));
      return seed;
    }
    return JSON.parse(raw) as T;
  } catch {
    return seed;
  }
}
function write<T>(key: string, val: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(key, JSON.stringify(val));
}

// -------- 文章 CRUD --------
export function getPosts(): AdminPost[] {
  return read(POSTS_KEY, seedPosts).sort((a, b) =>
    a.date < b.date ? 1 : -1
  );
}
export function getPost(slug: string): AdminPost | undefined {
  return getPosts().find((p) => p.slug === slug);
}
export function savePost(post: AdminPost) {
  const posts = read(POSTS_KEY, seedPosts);
  const idx = posts.findIndex((p) => p.slug === post.slug);
  if (idx >= 0) posts[idx] = post;
  else posts.push(post);
  write(POSTS_KEY, posts);
}
export function deletePost(slug: string) {
  const posts = read(POSTS_KEY, seedPosts).filter((p) => p.slug !== slug);
  write(POSTS_KEY, posts);
}

// -------- 模块 CRUD --------
export function getModules(): SiteModule[] {
  return read(MODULES_KEY, seedModules);
}
export function saveModule(mod: SiteModule) {
  const mods = read(MODULES_KEY, seedModules);
  const idx = mods.findIndex((m) => m.id === mod.id);
  if (idx >= 0) mods[idx] = mod;
  else mods.push(mod);
  write(MODULES_KEY, mods);
}
export function deleteModule(id: string) {
  const mods = read(MODULES_KEY, seedModules).filter((m) => m.id !== id);
  write(MODULES_KEY, mods);
}

// -------- 会员套餐初始数据 + CRUD --------
const seedPlans: MemberPlan[] = [
  {
    id: "plan-month",
    name: "月度会员",
    price: 29,
    period: "/月",
    features: ["全部付费文章", "实战视频教程", "会员专属下载"],
    highlight: false,
    enabled: true,
  },
  {
    id: "plan-year",
    name: "年度会员",
    price: 199,
    period: "/年",
    features: [
      "月度全部权益",
      "一对一人工咨询",
      "优先答疑",
      "全年持续更新",
    ],
    highlight: true,
    enabled: true,
  },
  {
    id: "plan-forever",
    name: "永久会员",
    price: 599,
    period: "永久",
    features: ["年度全部权益", "终身免费更新", "远程协助服务", "专属社群"],
    highlight: false,
    enabled: true,
  },
];
export function getPlans(): MemberPlan[] {
  return read(PLANS_KEY, seedPlans);
}
export function savePlan(plan: MemberPlan) {
  const plans = read(PLANS_KEY, seedPlans);
  const idx = plans.findIndex((p) => p.id === plan.id);
  if (idx >= 0) plans[idx] = plan;
  else plans.push(plan);
  write(PLANS_KEY, plans);
}
export function deletePlan(id: string) {
  write(
    PLANS_KEY,
    read(PLANS_KEY, seedPlans).filter((p) => p.id !== id)
  );
}

// -------- 广告位初始数据 + CRUD --------
const seedAds: AdSlot[] = [
  {
    id: "ad-vip",
    title: "加入阿凡达 VIP 会员",
    image:
      "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&q=80",
    link: "/vip",
    position: "侧边栏",
    enabled: true,
  },
  {
    id: "ad-tool",
    title: "高速下载器 · 立即获取",
    image:
      "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80",
    link: "#",
    position: "侧边栏",
    enabled: true,
  },
];
export function getAds(): AdSlot[] {
  return read(ADS_KEY, seedAds);
}
export function saveAd(ad: AdSlot) {
  const ads = read(ADS_KEY, seedAds);
  const idx = ads.findIndex((a) => a.id === ad.id);
  if (idx >= 0) ads[idx] = ad;
  else ads.push(ad);
  write(ADS_KEY, ads);
}
export function deleteAd(id: string) {
  write(
    ADS_KEY,
    read(ADS_KEY, seedAds).filter((a) => a.id !== id)
  );
}

// -------- 登录状态 --------
export function isLoggedIn(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(AUTH_KEY) === "1";
}
export function login(password: string): boolean {
  if (password === DEMO_PASSWORD) {
    localStorage.setItem(AUTH_KEY, "1");
    return true;
  }
  return false;
}
export function logout() {
  localStorage.removeItem(AUTH_KEY);
}
