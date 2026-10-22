/**
 * 订阅源清单：线③自动采集的输入。
 *
 * 存放位置：settings 表的 `feedSources` 键（JSON 数组）。
 * 这里只做纯校验，不碰数据库，便于单独测试。
 */

export interface FeedSource {
  /** 稳定标识，用于日志和去重，不由用户编辑 */
  id: string;
  /** 订阅地址，必须是公网 HTTPS */
  url: string;
  /** 展示名称 */
  name: string;
  /** 权重 0–1，影响选题打分中的“热度” */
  weight: number;
  enabled: boolean;
}

export const MAX_SOURCES = 30;

/**
 * 默认示例源。仅作起点参考——采集前请确认每个地址仍然有效，
 * 订阅失效时收集器会把它标记为错误但不影响其它源。
 */
export const DEFAULT_FEED_SOURCES: FeedSource[] = [
  {
    id: "infoq-cn",
    url: "https://www.infoq.cn/feed",
    name: "InfoQ 中文",
    weight: 0.8,
    enabled: true,
  },
  {
    id: "sspai",
    url: "https://sspai.com/feed",
    name: "少数派",
    weight: 0.7,
    enabled: true,
  },
  {
    id: "hn",
    url: "https://news.ycombinator.com/rss",
    name: "Hacker News",
    weight: 0.6,
    enabled: true,
  },
];

function badUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return "订阅地址必须是完整 URL";
  }
  if (u.protocol !== "https:") return "订阅地址必须是 HTTPS";
  if (u.username || u.password) return "订阅地址不能带账号密码";
  const host = u.hostname.toLowerCase();
  if (
    host === "localhost" ||
    host.endsWith(".local") ||
    host.endsWith(".localhost") ||
    /^[\d.]+$/.test(host) ||
    host.includes(":") ||
    host.includes("[")
  )
    return "订阅地址必须是公网域名，不能是内网地址";
  return null;
}

/** 把任意输入（JSON 字符串或数组）规范化为可信的订阅源列表。 */
export function normalizeFeedSources(raw: unknown): FeedSource[] {
  let list: unknown = raw;
  if (typeof raw === "string") {
    if (!raw.trim()) return [];
    try {
      list = JSON.parse(raw);
    } catch {
      throw new Error("订阅源配置不是合法 JSON");
    }
  }
  if (list === undefined || list === null) return [];
  if (!Array.isArray(list)) throw new Error("订阅源配置必须是数组");
  if (list.length > MAX_SOURCES)
    throw new Error(`最多只能配置 ${MAX_SOURCES} 个订阅源`);

  const out: FeedSource[] = [];
  const seen = new Set<string>();
  for (const item of list) {
    if (!item || typeof item !== "object") throw new Error("订阅源条目格式不正确");
    const r = item as Record<string, unknown>;
    const url = String(r.url ?? "").trim();
    const problem = badUrl(url);
    if (problem) throw new Error(`${problem}：${url || "(空)"}`);
    if (seen.has(url)) continue;
    seen.add(url);
    const name = String(r.name ?? "").trim().slice(0, 60) || new URL(url).hostname;
    const weightRaw = Number(r.weight ?? 0.5);
    const weight = Number.isFinite(weightRaw)
      ? Math.min(1, Math.max(0, weightRaw))
      : 0.5;
    const id =
      String(r.id ?? "").trim().slice(0, 40) ||
      new URL(url).hostname.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    out.push({ id, url, name, weight, enabled: r.enabled !== false });
  }
  return out;
}

export function enabledSources(sources: FeedSource[]): FeedSource[] {
  return sources.filter((s) => s.enabled);
}
