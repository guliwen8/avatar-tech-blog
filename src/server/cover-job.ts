import crypto from "node:crypto";
import { getDB } from "./db";
import { getPost, getSettings, setSetting, upsertPost } from "./repo";
import { generateArticleImage, resolveImageConfig } from "./article-images";
import { imagePrompt, imageSuggestions } from "../lib/article-images";
import { privateFileRoot } from "./file-runtime";

/** 生成封面所需的最低中文正文长度，避免给占位稿浪费额度。 */
export const COVER_MIN_CHINESE = 300;

/** 自动生成封面时写入 settings 的幂等标记前缀。 */
const MARK_PREFIX = "coverAuto:";

export type CoverSkipReason =
  | "not-found"
  | "has-cover"
  | "image-service-disabled"
  | "content-too-short"
  | "unchanged"
  | "no-plan";

export interface CoverJobResult {
  ok: boolean;
  skipped?: CoverSkipReason;
  url?: string;
  error?: string;
}

/** 文章指纹：标题、摘要、正文任一变化都会变。 */
export function coverHash(post: {
  title: string;
  description: string;
  content: string;
}): string {
  return crypto
    .createHash("sha256")
    .update(`${post.title}\n${post.description}\n${post.content}`)
    .digest("hex")
    .slice(0, 32);
}

export function countChinese(text: string): number {
  return (text.match(/[\u4e00-\u9fa5]/g) || []).length;
}

/**
 * 为指定文章补齐封面。
 *
 * 默认只处理「没有封面」的文章，不会覆盖人工上传的封面，
 * 也不会改动 published 状态（封面属于增强信息，不应让文章下线）。
 */
export async function ensurePostCover(
  slug: string,
  options: { force?: boolean; signal?: AbortSignal } = {},
): Promise<CoverJobResult> {
  const db = getDB();
  const post = getPost(slug);
  if (!post) return { ok: false, skipped: "not-found" };

  const hash = coverHash(post);

  if (post.cover && !options.force) {
    // 上次是我们自动生成的封面，且正文已变 → 允许重生成
    const previous = getSettings()[MARK_PREFIX + slug];
    if (!previous || previous === hash)
      return { ok: true, skipped: "has-cover" };
  }

  const config = resolveImageConfig(db);
  if (!config.enabled || !config.apiKey)
    return { ok: false, skipped: "image-service-disabled" };

  if (!options.force && countChinese(post.content) < COVER_MIN_CHINESE)
    return { ok: false, skipped: "content-too-short" };

  const plan = imageSuggestions(post).find((p) => p.role === "cover");
  if (!plan) return { ok: false, skipped: "no-plan" };

  const prompt = imagePrompt(post, plan);
  try {
    const image = await generateArticleImage(
      db,
      privateFileRoot(),
      config,
      { role: "cover", caption: plan.caption, section: plan.section, prompt },
      options.signal,
    );
    // 只写 cover，保留原有 published / is_vip / views
    upsertPost({ ...post, cover: image.url });
    setSetting(MARK_PREFIX + slug, hash);
    return { ok: true, url: image.url };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "封面生成失败",
    };
  }
}
