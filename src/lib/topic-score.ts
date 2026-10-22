/**
 * 选题打分：决定采集到的一批资讯里，先写哪一条。
 *
 * 公式（加权和，不是乘积——乘积会让任意一项为 0 就全废）：
 *   total = heat×0.4 + relevance×0.4 + novelty×0.2
 *
 * 中文没有天然分词，这里用「二元组集合重叠」近似 Jaccard 相似度，
 * 对标题这种短语级文本足够可靠，且不引入分词依赖。
 */

export interface TopicInput {
  title: string;
  summary?: string;
  /** 发布或更新时间，能解析就参与“新颖度”计算 */
  date?: string;
  /** 来源权重 0–1 */
  sourceWeight: number;
}

export interface ScoreContext {
  /** 站点已有词汇（标签、分类、历史标题），用于判断“跟我相关” */
  keywords: string[];
  /** 当前时间戳，传入以便测试可复现 */
  now: number;
  /** 近期已存在的标题，用于压制重复选题 */
  recentTitles?: string[];
}

export interface TopicScore {
  total: number;
  heat: number;
  relevance: number;
  novelty: number;
  reasons: string[];
}

const MS_DAY = 86400000;

/** 归一化：去掉空白与标点，只留字与数字。 */
export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

/** 二元组集合。单字文本退化为单元素集合。 */
export function bigrams(text: string): Set<string> {
  const t = normalizeText(text);
  const out = new Set<string>();
  if (t.length <= 1) {
    if (t) out.add(t);
    return out;
  }
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

/** Jaccard 相似度：交集 / 并集。 */
export function similarity(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const g of A) if (B.has(g)) inter++;
  return inter / (A.size + B.size - inter);
}

/** 与「站点词汇」的最高相似度，代表这条选题和我的领域有多贴。 */
function relevanceOf(text: string, keywords: string[]): number {
  let best = 0;
  for (const k of keywords) {
    if (!k.trim()) continue;
    const s = similarity(text, k);
    // 关键词短，完全包含也算强相关
    if (best < s) best = s;
    if (s === 0 && normalizeText(text).includes(normalizeText(k)))
      best = Math.max(best, 0.6);
  }
  return Math.min(1, best);
}

/** 越新越有价值；超过 14 天视为过时。无法解析日期时给中性值。 */
function noveltyOf(date: string | undefined, now: number): number {
  if (!date) return 0.5;
  const t = Date.parse(date);
  if (Number.isNaN(t)) return 0.5;
  const days = Math.max(0, (now - t) / MS_DAY);
  if (days <= 1) return 1;
  if (days <= 3) return 0.85;
  if (days <= 7) return 0.7;
  if (days <= 14) return 0.45;
  return 0.15;
}

export function scoreTopic(
  input: TopicInput,
  ctx: ScoreContext,
): TopicScore {
  const reasons: string[] = [];
  const text = `${input.title} ${input.summary ?? ""}`.trim();

  // 热度：来源权重为主，标题命中站点词汇额外加成
  const hits = ctx.keywords.filter(
    (k) => k.trim() && normalizeText(input.title).includes(normalizeText(k)),
  );
  const heat = Math.min(1, input.sourceWeight * 0.8 + Math.min(hits.length, 3) * 0.1);
  if (hits.length) reasons.push(`标题命中关键词 ${hits.slice(0, 3).join("、")}`);

  // 相关度：与站点词汇的整体接近程度
  const relevance = relevanceOf(text, ctx.keywords);
  if (relevance >= 0.5) reasons.push(`与站点领域贴近（${relevance.toFixed(2)}）`);

  // 新颖度：时间新鲜 + 不与近期标题重复
  let novelty = noveltyOf(input.date, ctx.now);
  let dup = 0;
  for (const t of ctx.recentTitles ?? []) {
    const s = similarity(input.title, t);
    if (s > dup) dup = s;
  }
  if (dup >= 0.7) {
    novelty = Math.min(novelty, 0.2);
    reasons.push(`与已有标题高度重复（${dup.toFixed(2)}）`);
  } else if (dup >= 0.45) {
    novelty = Math.min(novelty, 0.5);
    reasons.push(`与已有标题部分重复（${dup.toFixed(2)}）`);
  }

  const total = Math.round(
    (heat * 0.4 + relevance * 0.4 + novelty * 0.2) * 100,
  );
  return { total, heat, relevance, novelty, reasons };
}

/** 批量打分并按总分降序。 */
export function rankTopics<T extends TopicInput>(
  items: T[],
  ctx: ScoreContext,
): Array<T & { score: TopicScore }> {
  return items
    .map((item) => ({ ...item, score: scoreTopic(item, ctx) }))
    .sort((a, b) => b.score.total - a.score.total);
}
