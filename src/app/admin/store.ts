"use client";

// ============================================================
// 后台数据层 —— 现在通过后端 API 读写真实 SQLite 数据库。
// ============================================================

export interface AdminPost {
  slug: string;
  title: string;
  date: string;
  category: string;
  tags: string[];
  description: string;
  cover: string;
  content: string;
  published: boolean;
}

export interface SiteModule {
  id: string;
  type: "nav" | "sidebar" | string;
  label: string;
  value: string;
  enabled: boolean;
  sort?: number;
}

export interface MemberPlan {
  id: string;
  name: string;
  price: number;
  period: string;
  features: string[];
  highlight: boolean;
  enabled: boolean;
  sort?: number;
}

export interface AdSlot {
  id: string;
  title: string;
  image: string;
  link: string;
  position: string;
  enabled: boolean;
  sort?: number;
}

export interface Order {
  id: string;
  plan_id: string;
  plan_name: string;
  amount: number;
  method: string;
  status: string;
  contact: string;
  created_at: string;
  paid_at: string | null;
}

async function api<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...(opts?.headers || {}) },
  });
  if (res.status === 401) {
    // 未登录 → 跳回登录
    window.location.href = "/admin";
    throw new Error("未登录");
  }
  return res.json();
}

// -------- 认证 --------
export async function checkAuth(): Promise<boolean> {
  const r = await fetch("/api/auth");
  const d = await r.json();
  return !!d.authed;
}
export async function login(username: string, password: string): Promise<boolean> {
  const r = await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  const d = await r.json();
  return !!d.ok;
}
export async function logout() {
  await fetch("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "logout" }),
  });
}

// -------- 文章 --------
export function getPosts(): Promise<AdminPost[]> {
  return api<AdminPost[]>("/api/posts");
}
export async function getPost(slug: string): Promise<AdminPost | undefined> {
  const posts = await getPosts();
  return posts.find((p) => p.slug === slug);
}
export function savePost(post: AdminPost): Promise<{ ok: boolean; slug: string }> {
  return api("/api/posts", { method: "POST", body: JSON.stringify(post) });
}
export function deletePost(slug: string) {
  return api(`/api/posts?slug=${encodeURIComponent(slug)}`, {
    method: "DELETE",
  });
}

// -------- 模块 --------
export function getModules(): Promise<SiteModule[]> {
  return api<SiteModule[]>("/api/modules");
}
export function saveModule(mod: SiteModule) {
  return api("/api/modules", { method: "POST", body: JSON.stringify(mod) });
}
export function deleteModule(id: string) {
  return api(`/api/modules?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

// -------- 套餐 --------
export function getPlans(): Promise<MemberPlan[]> {
  return api<MemberPlan[]>("/api/plans");
}
export function savePlan(plan: MemberPlan) {
  return api("/api/plans", { method: "POST", body: JSON.stringify(plan) });
}
export function deletePlan(id: string) {
  return api(`/api/plans?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

// -------- 广告位 --------
export function getAds(): Promise<AdSlot[]> {
  return api<AdSlot[]>("/api/ads");
}
export function saveAd(ad: AdSlot) {
  return api("/api/ads", { method: "POST", body: JSON.stringify(ad) });
}
export function deleteAd(id: string) {
  return api(`/api/ads?id=${encodeURIComponent(id)}`, { method: "DELETE" });
}

// -------- 订单 --------
export function getOrders(): Promise<Order[]> {
  return api<Order[]>("/api/orders", {
    method: "POST",
    body: JSON.stringify({ action: "list" }),
  });
}

// -------- 设置 --------
export function getSettings(): Promise<Record<string, string>> {
  return api<Record<string, string>>("/api/settings");
}
export function saveSettings(data: Record<string, string>) {
  return api("/api/settings", { method: "POST", body: JSON.stringify(data) });
}
