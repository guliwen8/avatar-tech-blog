import { pinyin } from "pinyin-pro";

/**
 * 生成可读的 URL slug。
 *
 * - 英文、数字原样保留
 * - 中文转成无声调拼音（如「选电脑」→ xuan-dian-nao）
 * - 其余符号统一压成单个连字符
 * - 超长时按连字符边界截断，不会切出半个词
 *
 * 编辑器与接口共用同一份实现，保证「预览看到的」就是「保存后的」。
 */
export function slugify(input: string, maxLength = 60): string {
  const text = (input || "").trim();
  if (!text) return "";

  let segments: string;
  try {
    segments = pinyin(text, {
      toneType: "none",
      type: "array",
      nonZh: "consecutive",
    }).join(" ");
  } catch {
    // 拼音库异常时退化为原文，后面的正则仍能把 ASCII 提出一份可用的 slug
    segments = text;
  }

  const slug = segments
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (!slug) return "";
  if (slug.length <= maxLength) return slug;
  // 在连字符处截断，避免出现半个音节
  const cut = slug.slice(0, maxLength);
  return cut.includes("-") ? cut.replace(/-[^-]*$/, "") : cut;
}

/** 纯 ASCII 标题也能用；空结果时退回空串，由调用方决定兜底策略。 */
export function slugifyOrEmpty(input: string): string {
  return slugify(input);
}
