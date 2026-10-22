/**
 * 会员期限与订单编号。
 *
 * 这里是收费模块的地基：所有“买多久”“从哪天算”“续费怎么叠”都在这一层决定。
 * 纯函数、无 IO，便于单独测试。
 */

export const DAY_MS = 86400000;
/** 会员期上限，与 grantMembership 的校验保持一致（10 年）。 */
export const MAX_MEMBER_MS = 10 * 366 * DAY_MS;

/** 避免 0/O、1/I 这类易混字符，方便用户把付款码打进转账备注。 */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** 把套餐的 period 文案转成时长（毫秒）。 */
export function planDurationMs(period: string): number {
  const p = (period || "").trim();
  if (/永久|终身|长期|lifetime|forever/i.test(p)) return MAX_MEMBER_MS;

  const num = p.match(/(\d+(?:\.\d+)?)/);
  const n = num ? Number(num[1]) : 1;

  if (/年|year|yr/i.test(p)) return Math.round(n * 365 * DAY_MS);
  if (/季度|季|quarter/i.test(p)) return Math.round(n * 90 * DAY_MS);
  if (/月|month|mon/i.test(p)) return Math.round(n * 30 * DAY_MS);
  if (/周|week/i.test(p)) return Math.round(n * 7 * DAY_MS);
  if (/天|日|day/i.test(p)) return Math.round(n * DAY_MS);

  // 无法识别时按月度处理，避免算出 0 导致“付了钱没开通”
  return 30 * DAY_MS;
}

/**
 * 计算续费后的到期时间。
 *
 * 规则：
 * - 当前仍是会员 → 从原到期日往后叠加（不浪费剩余天数）
 * - 已过期或从未开通 → 从现在起算
 * - 结果不超过上限
 */
export function extendUntil(
  currentUntil: number,
  addMs: number,
  now = Date.now(),
): number {
  const safeCurrent =
    Number.isFinite(currentUntil) && currentUntil > 0 ? currentUntil : 0;
  const base = safeCurrent > now ? safeCurrent : now;
  const next = base + Math.max(0, addMs);
  return Math.min(next, now + MAX_MEMBER_MS);
}

/** 6 位大写付款码，用户填在转账备注里。 */
export function payCode(random: () => number = Math.random): string {
  let out = "";
  for (let i = 0; i < 6; i++)
    out += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length)];
  return out;
}

/** 订单号：ORD + 年月日 + 6 位随机，便于人工抄写与对账。 */
export function orderId(now = new Date(), random: () => number = Math.random): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `ORD${y}${m}${d}${payCode(random)}`;
}

/** 到期日的可读格式（YYYY-MM-DD，本地时区）。 */
export function formatUntil(until: number): string {
  if (!until || until <= 0) return "—";
  const d = new Date(until);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export interface PlanLike {
  id: string;
  name: string;
  price: number;
  period: string;
}

/** 下单时给用户看的套餐说明，避免前端自己算时长。 */
export function describePlan(plan: PlanLike, now = Date.now()) {
  const ms = planDurationMs(plan.period);
  return {
    id: plan.id,
    name: plan.name,
    price: plan.price,
    period: plan.period,
    days: Math.round(ms / DAY_MS),
    untilIfBoughtNow: extendUntil(0, ms, now),
  };
}
