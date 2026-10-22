export interface ArticleImage {
  id: string;
  url: string;
  role: "cover" | "body";
  caption: string;
  section: string;
  prompt: string;
}
export type ImagePlan = Pick<ArticleImage, "role" | "caption" | "section">;
export function normalizeArticleImage(value: unknown): ArticleImage {
  const r = value as ArticleImage;
  if (
    !r ||
    !/^[a-f0-9-]{36}$/.test(r.id) ||
    r.url !== `/api/files/${r.id}` ||
    !["cover", "body"].includes(r.role)
  )
    throw Error("图片资料格式不正确");
  for (const [key, max] of [
    ["caption", 200],
    ["section", 200],
    ["prompt", 1500],
  ] as const)
    if (typeof r[key] !== "string" || r[key].length > max)
      throw Error("图片说明过长或格式不正确");
  return {
    id: r.id,
    url: r.url,
    role: r.role,
    caption: r.caption,
    section: r.section,
    prompt: r.prompt,
  };
}
export function imageSuggestions(article: {
  title: string;
  content: string;
}): ImagePlan[] {
  const prose = article.content.replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, "");
  const sections = [...prose.matchAll(/^#{2,3}\s+(.+)$/gm)]
    .map((m) => m[1].trim())
    .filter((s) => !/参考|来源|链接|版权/.test(s));
  return [
    { role: "cover", caption: article.title.slice(0, 200), section: "" },
    ...Array.from(new Set(sections.length ? sections : ["正文示意图"]))
      .slice(0, 3)
      .map((section) => ({
        role: "body" as const,
        caption: section.slice(0, 200),
        section: sections.length ? section.slice(0, 200) : "",
      })),
  ];
}
/**
 * 清洗会触发图片审核的文本。
 *
 * 搬运视频的 ASR 转写里几乎必然带「点赞/订阅/关注/铁铁/加群」这类引流话术，
 * 原样放进 prompt 会被 MiniMax 以 1026 拒绝。这些词对配图也毫无意义，直接删掉。
 */
export function sanitizeForImagePrompt(raw: string): string {
  const cleaned = raw
    .replace(/```[\s\S]*?```|~~~[\s\S]*?~~~/g, "")
    .replace(/!\[[^\]\n]*\]\([^\n)]*\)/g, "")
    .replace(/^\*.*AI 生成示意图\*$/gm, "")
    .replace(/`[^`\n]+`/g, "")
    .replace(/https?:\/\/\S+/g, "")
    // 引流/求关注话术：连同所在的那一小句一起删掉
    .replace(
      /[^。！？\n]{0,15}(点赞|订阅|关注|一键三连|三连|转发|收藏|打赏|投币|铁铁|宝子|加群|进群|私信|公众号|微信|加v|扫码|领取|福利|优惠|求关注)[^。！？\n]{0,25}[。！？!?~～]?/gi,
      "",
    )
    .replace(/[ \t\u3000]+/g, " ")
    .trim();
  return dedupeSentences(cleaned);
}

/** 去掉重复句子——拼接多个来源时常出现同一句反复出现。 */
export function dedupeSentences(text: string): string {
  const parts = text.split(/(?<=[。！？!?])/);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of parts) {
    const key = normalizeSentence(p);
    if (!key) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p.trim());
  }
  return out.join("").trim();
}

function normalizeSentence(s: string): string {
  return s.replace(/[\s\p{P}\p{S}]+/gu, "").toLowerCase();
}

const STYLE =
  "科技插画，浅蓝与白色为主，简洁明亮，16:9 横图，主体清晰，留白适中，不要文字、商标、水印";

export function imagePrompt(
  article: { title: string; description: string; content: string },
  plan: ImagePlan,
) {
  // 只给画面主题，不塞整段正文。
  // MiniMax 对长 prompt（尤其是搬运视频转写里的营销话术）非常敏感，
  // 会直接以 1026 拒绝；而配图本来也不需要正文细节。
  const title = sanitizeForImagePrompt(article.title).slice(0, 50);
  const section = plan.section
    ? sanitizeForImagePrompt(plan.section).slice(0, 30)
    : "";
  const summary = sanitizeForImagePrompt(article.description).slice(0, 50);
  const topic = [title, section, summary].filter(Boolean).join("；");
  return `${STYLE}。画面主题：${topic}`.slice(0, 200);
}

/** 审核被拒后的兜底：只保留风格与一个极短主题。 */
export function minimalImagePrompt(article: { title: string }): string {
  const title = sanitizeForImagePrompt(article.title).slice(0, 24);
  return `${STYLE}。${title}`.slice(0, 120);
}
export function insertArticleImage(content: string, image: ArticleImage) {
  const caption = image.caption.replace(/[\[\]\\\r\n]/g, " ");
  const block = `\n\n![${caption}（AI 生成示意图）](${image.url})\n\n*${caption} · AI 生成示意图*\n`;
  if (content.includes(image.url)) return content;
  // Locate exact headings outside fenced code, never insert into commands.
  let fenced = false;
  const lines = content.split("\n");
  for (let i = 0; i < lines.length; i++) {
    if (/^\s*(```|~~~)/.test(lines[i])) {
      fenced = !fenced;
      continue;
    }
    if (
      !fenced &&
      /^#{2,3}\s+/.test(lines[i]) &&
      lines[i].replace(/^#{2,3}\s+/, "").trim() === image.section
    )
      return [...lines.slice(0, i + 1), block, ...lines.slice(i + 1)].join(
        "\n",
      );
  }
  return content + block;
}
