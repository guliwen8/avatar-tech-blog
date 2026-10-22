import type { ContentDetails } from "./content-details";

/**
 * 发布闸门：文章从草稿变成已发布之前必须通过的硬性检查。
 *
 * 设计原则
 * - 只拦「发布」，不拦「保存草稿」——写作过程不该被打断。
 * - 按内容类型给不同阈值：视频/资源/项目不要求长正文。
 * - 检查代码块之外的内容，避免把示例代码里的 `...` 误判为占位符。
 */

export type GateId =
  | "title"
  | "length"
  | "substance"
  | "stub"
  | "slug"
  | "description"
  | "cover";

export interface GateResult {
  id: GateId;
  ok: boolean;
  /** 通过时为简短说明，失败时为可直接展示给作者的原因。 */
  message: string;
}

export interface GateReport {
  pass: boolean;
  gates: GateResult[];
  failures: GateResult[];
}

export interface GateInput {
  slug: string;
  title: string;
  description: string;
  content: string;
  cover: string;
  details?: ContentDetails;
}

const FENCED = /```[\s\S]*?```|~~~[\s\S]*?~~~/g;
const UUID =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

/** 去掉围栏代码块后的正文，用于字数与占位符判断。 */
export function proseOf(content: string): string {
  return content.replace(FENCED, "");
}

export function countChinese(text: string): number {
  return (text.match(/[\u4e00-\u9fa5]/g) || []).length;
}

/** 各类内容要求的最低中文字数。 */
export function minChinese(kind: ContentDetails["kind"] | undefined): number {
  switch (kind) {
    case "video":
      return 300;
    case "resource":
    case "project":
      return 200;
    default:
      // 文章 500 字：够撑起一个完整技术主题，又不至于把作者卡死
      return 500;
  }
}

export function qualityGate(
  input: GateInput,
  options: { published: boolean },
): GateReport {
  // 草稿不做检查
  if (!options.published)
    return { pass: true, gates: [], failures: [] };

  const kind = input.details?.kind ?? "auto";
  const prose = proseOf(input.content);
  const chinese = countChinese(prose);
  const need = minChinese(kind);
  const gates: GateResult[] = [];

  const title = input.title.trim();
  gates.push({
    id: "title",
    ok: title.length >= 5 && !/^(untitled|无标题|测试|test)/i.test(title),
    message:
      title.length >= 5 && !/^(untitled|无标题|测试|test)/i.test(title)
        ? "标题有效"
        : "标题至少 5 个字，且不能是「测试」「无标题」之类的占位标题",
  });

  gates.push({
    id: "length",
    ok: chinese >= need,
    message:
      chinese >= need
        ? `正文 ${chinese} 字`
        : `正文只有 ${chinese} 字，${kind === "auto" || kind === "article" ? "文章" : "该类内容"}至少需要 ${need} 字`,
  });

  const hasCode = /```/.test(input.content) || /~~~/.test(input.content);
  const hasImage = /!\[[^\]]*\]\([^)]+\)/.test(input.content);
  const substanceOk =
    kind === "video" || kind === "resource" || kind === "project"
      ? true
      : hasCode || hasImage;
  gates.push({
    id: "substance",
    ok: substanceOk,
    message: substanceOk
      ? "包含代码或配图"
      : "文章至少需要一段代码块或一张配图，纯文字不算技术文章",
  });

  const stub = prose.match(/待确认|TODO|FIXME|占位符?|XXX+/);
  gates.push({
    id: "stub",
    ok: !stub,
    message: stub
      ? `正文残留占位内容「${stub[0]}」，请写完再发布`
      : "无占位内容",
  });

  const slugOk =
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(input.slug) &&
    input.slug.length >= 3 &&
    input.slug.length <= 80 &&
    !UUID.test(input.slug) &&
    !/%[0-9a-f]{2}/i.test(input.slug);
  gates.push({
    id: "slug",
    ok: slugOk,
    message: slugOk
      ? "URL 可读"
      : "URL 必须是小写字母/数字/连字符，且不能是 UUID 或中文编码",
  });

  const desc = input.description.trim();
  gates.push({
    id: "description",
    ok: desc.length >= 40,
    message:
      desc.length >= 40
        ? "摘要完整"
        : `摘要只有 ${desc.length} 字，至少需要 40 字（用于列表与搜索展示）`,
  });

  gates.push({
    id: "cover",
    ok: !!input.cover.trim(),
    message: input.cover.trim() ? "有封面" : "缺少封面图",
  });

  const failures = gates.filter((g) => !g.ok);
  return { pass: failures.length === 0, gates, failures };
}

/** 把失败原因拼成一句可直接返回给前端的话。 */
export function gateMessage(report: GateReport): string {
  return report.failures.map((f) => f.message).join("；");
}
