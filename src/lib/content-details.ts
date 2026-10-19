export type ContentKind = "auto" | "article" | "video" | "resource" | "project";
export interface ContentDetails {
  kind: ContentKind;
  access?: "public" | "login" | "member";
  videoUrl?: string;
  sourceUrl?: string;
  duration?: string;
  version?: string;
  platform?: string;
  downloadUrl?: string;
  repoUrl?: string;
  demoUrl?: string;
  license?: string;
  environment?: string;
}
export function normalizeDetails(raw: unknown): ContentDetails {
  if (raw === undefined || raw === null) return { kind: "auto" };
  if (typeof raw !== "object" || Array.isArray(raw))
    throw new Error("内容资料格式不正确");
  const obj = raw as Record<string, unknown>;
  const kind = obj.kind ?? "auto";
  if (
    !["auto", "article", "video", "resource", "project"].includes(String(kind))
  )
    throw new Error("请选择有效的内容类型");
  const result: ContentDetails = { kind: kind as ContentKind };
  if (obj.access !== undefined) {
    if (!["public", "login", "member"].includes(String(obj.access)))
      throw new Error("访问权限无效");
    result.access = obj.access as ContentDetails["access"];
  }
  const urls = ["videoUrl", "sourceUrl", "downloadUrl", "repoUrl", "demoUrl"];
  const keys = [
    ...urls,
    "duration",
    "version",
    "platform",
    "license",
    "environment",
  ] as const;
  for (const key of keys) {
    const value = obj[key];
    if (value === undefined || value === "") continue;
    if (
      typeof value !== "string" ||
      value.length > (urls.includes(key) ? 2048 : 300)
    )
      throw new Error("内容资料字段过长或格式不正确");
    const trimmed = value.trim();
    if (!trimmed) continue;
    if (urls.includes(key)) {
      const privateFile =
        ["videoUrl", "downloadUrl"].includes(key) &&
        /^\/api\/files\/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(
          trimmed,
        );
      const upload =
        key === "videoUrl" &&
        /^\/uploads\/[a-zA-Z0-9_/-]+\.(mp4|webm)$/i.test(trimmed) &&
        !trimmed.includes("..");
      if (!upload && !privateFile) {
        let u: URL;
        try {
          u = new URL(trimmed);
        } catch {
          throw new Error("链接请填写完整的 HTTPS 地址");
        }
        if (
          u.protocol !== "https:" ||
          u.username ||
          u.password ||
          u.hostname === "localhost" ||
          u.hostname.endsWith(".local") ||
          u.hostname.endsWith(".localhost") ||
          /^[\d.]+$/.test(u.hostname) ||
          u.hostname.includes(":")
        )
          throw new Error("链接请使用公开的 HTTPS 地址");
        if (key === "videoUrl" && !/\.(mp4|webm)$/i.test(u.pathname))
          throw new Error(
            "播放地址需为 MP4 或 WebM 文件；平台页面请填原平台链接",
          );
      }
    }
    Object.assign(result, { [key]: trimmed });
  }
  return result;
}
export function validateDetailsForPublication(
  raw: unknown,
  published: boolean,
): ContentDetails {
  const d = normalizeDetails(raw);
  if (!published) return d;
  if (d.access && d.access !== "public" && d.videoUrl?.startsWith("/uploads/"))
    throw new Error(
      "受限视频请使用本站私有上传，公开 uploads 地址不能提供文件权限保护",
    );
  if (d.kind === "video" && !d.videoUrl && !d.sourceUrl)
    throw new Error("视频请填写播放地址或原平台链接");
  if (d.kind === "resource" && !d.downloadUrl)
    throw new Error("免费资源请填写下载地址");
  if (d.kind === "project" && !d.repoUrl)
    throw new Error("开源项目请填写代码仓库地址");
  return d;
}
