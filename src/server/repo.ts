import { normalizeEditorial, type EditorialData } from "../lib/editorial";
import { normalizeDetails, type ContentDetails } from "../lib/content-details";
import { getDB } from "./db";

// ===== 类型 =====
export interface Post {
  editorial?: EditorialData;
  details?: ContentDetails;
  slug: string;
  title: string;
  date: string;
  category: string;
  tags: string[];
  description: string;
  cover: string;
  content: string;
  published: boolean;
  is_vip: boolean;
  views: number;
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
export type OrderStatus =
  | "pending" // 已下单，等用户付款
  | "submitted" // 用户点了「我已付款」，等管理员核对
  | "paid" // 管理员已确认收款，会员已开通
  | "rejected" // 管理员核对不通过
  | "refunded" // 已退款
  | "cancelled"; // 用户或管理员取消

export interface Order {
  id: string;
  plan_id: string;
  plan_name: string;
  amount: number;
  method: string;
  status: OrderStatus;
  contact: string;
  /** 下单的会员账号 ID */
  member_id: string;
  /** 6 位付款码，用户填在转账备注里 */
  pay_code: string;
  created_at: string;
  submitted_at: string | null;
  confirmed_at: string | null;
  paid_at: string | null;
  operated_by: string;
  order_note: string;
  refunded_at: string | null;
  refund_amount: number | null;
  /** 本单开通后的到期日，退款回滚时用 */
  granted_until: number | null;
}

/* eslint-disable @typescript-eslint/no-explicit-any */

// ===== 文章 =====
function readDetails(raw: string | undefined): ContentDetails {
  try {
    return normalizeDetails(JSON.parse(raw || "{}"));
  } catch {
    return { kind: "auto", access: "member" };
  }
}
function rowToPost(r: any): Post {
  return {
    editorial: normalizeEditorial(JSON.parse(r.editorial || "{}")),
    slug: r.slug,
    title: r.title,
    date: r.date,
    category: r.category,
    tags: JSON.parse(r.tags || "[]"),
    description: r.description,
    cover: r.cover,
    content: r.content,
    published: !!r.published,
    is_vip: !!r.is_vip,
    views: r.views || 0,
    details: readDetails(r.details),
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
      `INSERT INTO posts (slug,title,date,category,tags,description,cover,content,published,is_vip,views,details,editorial)
       VALUES (@slug,@title,@date,@category,@tags,@description,@cover,@content,@published,@is_vip,@views,@details,@editorial)
       ON CONFLICT(slug) DO UPDATE SET
         title=@title, date=@date, category=@category, tags=@tags,
         description=@description, cover=@cover, content=@content,
         published=@published, is_vip=@is_vip, details=@details, editorial=@editorial`,
    )
    .run({
      ...p,
      editorial: JSON.stringify(normalizeEditorial(p.editorial)),
      details: JSON.stringify(normalizeDetails(p.details)),
      tags: JSON.stringify(p.tags),
      published: p.published ? 1 : 0,
      is_vip: p.is_vip ? 1 : 0,
      views: p.views || 0,
    });
}
export function deletePost(slug: string) {
  getDB().prepare("DELETE FROM posts WHERE slug = ?").run(slug);
}
// 文章浏览量 +1
export function incrementViews(slug: string) {
  getDB()
    .prepare("UPDATE posts SET views = views + 1 WHERE slug = ?")
    .run(slug);
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
         highlight=@highlight, enabled=@enabled, sort=@sort`,
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
         enabled=@enabled, sort=@sort`,
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
  return (type ? stmt.all(type) : stmt.all()).map(
    rowToMod as any,
  ) as SiteModule[];
}
export function upsertModule(m: SiteModule) {
  getDB()
    .prepare(
      `INSERT INTO modules (id,type,label,value,enabled,sort)
       VALUES (@id,@type,@label,@value,@enabled,@sort)
       ON CONFLICT(id) DO UPDATE SET
         type=@type, label=@label, value=@value, enabled=@enabled, sort=@sort`,
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
      "INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=?",
    )
    .run(key, value, value);
}

// ===== 订单 =====
function rowToOrder(r: any): Order {
  return r as Order;
}
export function createOrder(o: {
  id: string;
  plan_id: string;
  plan_name: string;
  amount: number;
  method: string;
  contact?: string;
  member_id: string;
  pay_code: string;
}) {
  getDB()
    .prepare(
      `INSERT INTO orders (id,plan_id,plan_name,amount,method,status,contact,member_id,pay_code)
       VALUES (@id,@plan_id,@plan_name,@amount,@method,'pending',@contact,@member_id,@pay_code)`,
    )
    .run({ contact: "", ...o });
}
/** 用户点了「我已付款」，进入待核对队列。只允许从 pending 迁移。 */
export function markOrderSubmitted(id: string, note = ""): boolean {
  return (
    getDB()
      .prepare(
        `UPDATE orders SET status='submitted', submitted_at=datetime('now'), order_note=?
         WHERE id=? AND status='pending'`,
      )
      .run(note.slice(0, 500), id).changes > 0
  );
}
/**
 * 管理员确认收款。
 * 只允许从 pending / submitted 迁移，且用条件更新保证同一笔不会重复开通。
 */
export function markOrderPaid(
  id: string,
  opts: { operated_by?: string; note?: string; granted_until?: number } = {},
): boolean {
  return (
    getDB()
      .prepare(
        `UPDATE orders SET
           status='paid',
           paid_at=datetime('now'),
           confirmed_at=datetime('now'),
           operated_by=?,
           order_note=CASE WHEN ?='' THEN order_note ELSE ? END,
           granted_until=?
         WHERE id=? AND status IN ('pending','submitted')`,
      )
      .run(
        (opts.operated_by || "").slice(0, 60),
        opts.note || "",
        (opts.note || "").slice(0, 500),
        opts.granted_until ?? null,
        id,
      ).changes > 0
  );
}
/** 管理员核对不通过。 */
export function markOrderRejected(id: string, note: string): boolean {
  return (
    getDB()
      .prepare(
        `UPDATE orders SET status='rejected', order_note=?
         WHERE id=? AND status IN ('pending','submitted')`,
      )
      .run(note.slice(0, 500), id).changes > 0
  );
}
/** 退款：记录金额与原因，不改 status 之外的会员期（由调用方回滚）。 */
export function markOrderRefunded(
  id: string,
  amount: number,
  note: string,
): boolean {
  return (
    getDB()
      .prepare(
        `UPDATE orders SET status='refunded', refunded_at=datetime('now'),
           refund_amount=?, order_note=?
         WHERE id=? AND status='paid'`,
      )
      .run(amount, note.slice(0, 500), id).changes > 0
  );
}
/** 待核对队列：用户已提交、还没确认的订单。 */
export function listPendingOrders(): Order[] {
  return (
    getDB()
      .prepare(
        "SELECT * FROM orders WHERE status IN ('pending','submitted') ORDER BY created_at DESC",
      )
      .all() as any[]
  ).map(rowToOrder);
}
export function getOrder(id: string): Order | null {
  const r = getDB().prepare("SELECT * FROM orders WHERE id = ?").get(id);
  return r ? rowToOrder(r) : null;
}
export function listOrders(): Order[] {
  return (
    getDB()
      .prepare("SELECT * FROM orders ORDER BY created_at DESC")
      .all() as any[]
  ).map(rowToOrder);
}
