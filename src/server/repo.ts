import { getDB } from "./db";

// ===== 类型 =====
export interface Post {
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
export interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  features: string[];
  highlight: boolean;
  enabled: boolean;
  sort: number;
}
export interface Ad {
  id: string;
  title: string;
  image: string;
  link: string;
  position: string;
  enabled: boolean;
  sort: number;
}
export interface SiteModule {
  id: string;
  type: string;
  label: string;
  value: string;
  enabled: boolean;
  sort: number;
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

/* eslint-disable @typescript-eslint/no-explicit-any */

// ===== 文章 =====
function rowToPost(r: any): Post {
  return {
    slug: r.slug,
    title: r.title,
    date: r.date,
    category: r.category,
    tags: JSON.parse(r.tags || "[]"),
    description: r.description,
    cover: r.cover,
    content: r.content,
    published: !!r.published,
  };
}
export function listPosts(onlyPublished = false): Post[] {
  const sql = onlyPublished
    ? "SELECT * FROM posts WHERE published = 1 ORDER BY date DESC"
    : "SELECT * FROM posts ORDER BY date DESC";
  return (getDB().prepare(sql).all() as any[]).map(rowToPost);
}
export function getPost(slug: string): Post | null {
  const r = getDB().prepare("SELECT * FROM posts WHERE slug = ?").get(slug);
  return r ? rowToPost(r) : null;
}
export function upsertPost(p: Post) {
  getDB()
    .prepare(
      `INSERT INTO posts (slug,title,date,category,tags,description,cover,content,published)
       VALUES (@slug,@title,@date,@category,@tags,@description,@cover,@content,@published)
       ON CONFLICT(slug) DO UPDATE SET
         title=@title, date=@date, category=@category, tags=@tags,
         description=@description, cover=@cover, content=@content, published=@published`
    )
    .run({
      ...p,
      tags: JSON.stringify(p.tags),
      published: p.published ? 1 : 0,
    });
}
export function deletePost(slug: string) {
  getDB().prepare("DELETE FROM posts WHERE slug = ?").run(slug);
}

// ===== 套餐 =====
function rowToPlan(r: any): Plan {
  return {
    id: r.id,
    name: r.name,
    price: r.price,
    period: r.period,
    features: JSON.parse(r.features || "[]"),
    highlight: !!r.highlight,
    enabled: !!r.enabled,
    sort: r.sort,
  };
}
export function listPlans(onlyEnabled = false): Plan[] {
  const sql = onlyEnabled
    ? "SELECT * FROM plans WHERE enabled = 1 ORDER BY sort"
    : "SELECT * FROM plans ORDER BY sort";
  return (getDB().prepare(sql).all() as any[]).map(rowToPlan);
}
export function getPlan(id: string): Plan | null {
  const r = getDB().prepare("SELECT * FROM plans WHERE id = ?").get(id);
  return r ? rowToPlan(r) : null;
}
export function upsertPlan(p: Plan) {
  getDB()
    .prepare(
      `INSERT INTO plans (id,name,price,period,features,highlight,enabled,sort)
       VALUES (@id,@name,@price,@period,@features,@highlight,@enabled,@sort)
       ON CONFLICT(id) DO UPDATE SET
         name=@name, price=@price, period=@period, features=@features,
         highlight=@highlight, enabled=@enabled, sort=@sort`
    )
    .run({
      ...p,
      features: JSON.stringify(p.features),
      highlight: p.highlight ? 1 : 0,
      enabled: p.enabled ? 1 : 0,
    });
}
export function deletePlan(id: string) {
  getDB().prepare("DELETE FROM plans WHERE id = ?").run(id);
}

// ===== 广告位 =====
function rowToAd(r: any): Ad {
  return { ...r, enabled: !!r.enabled };
}
export function listAds(onlyEnabled = false): Ad[] {
  const sql = onlyEnabled
    ? "SELECT * FROM ads WHERE enabled = 1 ORDER BY sort"
    : "SELECT * FROM ads ORDER BY sort";
  return (getDB().prepare(sql).all() as any[]).map(rowToAd);
}
export function upsertAd(a: Ad) {
  getDB()
    .prepare(
      `INSERT INTO ads (id,title,image,link,position,enabled,sort)
       VALUES (@id,@title,@image,@link,@position,@enabled,@sort)
       ON CONFLICT(id) DO UPDATE SET
         title=@title, image=@image, link=@link, position=@position,
         enabled=@enabled, sort=@sort`
    )
    .run({ ...a, enabled: a.enabled ? 1 : 0 });
}
export function deleteAd(id: string) {
  getDB().prepare("DELETE FROM ads WHERE id = ?").run(id);
}

// ===== 结构模块 =====
function rowToMod(r: any): SiteModule {
  return { ...r, enabled: !!r.enabled };
}
export function listModules(type?: string): SiteModule[] {
  const sql = type
    ? "SELECT * FROM modules WHERE type = ? ORDER BY sort"
    : "SELECT * FROM modules ORDER BY sort";
  const stmt = getDB().prepare(sql);
  return (type ? stmt.all(type) : stmt.all()).map(rowToMod as any) as SiteModule[];
}
export function upsertModule(m: SiteModule) {
  getDB()
    .prepare(
      `INSERT INTO modules (id,type,label,value,enabled,sort)
       VALUES (@id,@type,@label,@value,@enabled,@sort)
       ON CONFLICT(id) DO UPDATE SET
         type=@type, label=@label, value=@value, enabled=@enabled, sort=@sort`
    )
    .run({ ...m, enabled: m.enabled ? 1 : 0 });
}
export function deleteModule(id: string) {
  getDB().prepare("DELETE FROM modules WHERE id = ?").run(id);
}

// ===== 设置 =====
export function getSettings(): Record<string, string> {
  const rows = getDB().prepare("SELECT key,value FROM settings").all() as any[];
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return out;
}
export function setSetting(key: string, value: string) {
  getDB()
    .prepare(
      "INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=?"
    )
    .run(key, value, value);
}

// ===== 订单 =====
function rowToOrder(r: any): Order {
  return r as Order;
}
export function createOrder(o: Omit<Order, "created_at" | "paid_at">) {
  getDB()
    .prepare(
      `INSERT INTO orders (id,plan_id,plan_name,amount,method,status,contact)
       VALUES (@id,@plan_id,@plan_name,@amount,@method,@status,@contact)`
    )
    .run(o);
}
export function markOrderPaid(id: string) {
  getDB()
    .prepare(
      "UPDATE orders SET status='paid', paid_at=datetime('now') WHERE id = ?"
    )
    .run(id);
}
export function getOrder(id: string): Order | null {
  const r = getDB().prepare("SELECT * FROM orders WHERE id = ?").get(id);
  return r ? rowToOrder(r) : null;
}
export function listOrders(): Order[] {
  return (
    getDB().prepare("SELECT * FROM orders ORDER BY created_at DESC").all() as any[]
  ).map(rowToOrder);
}
