import type { ContentDetails } from "./content-details";
export type Channel =
  | "all"
  | "videos"
  | "resources"
  | "member-videos"
  | "tutorials"
  | "notes"
  | "projects";
interface CatalogItem {
  details?: ContentDetails;
  title: string;
  category: string;
  tags: string[];
  description: string;
  isVip: boolean;
}
export const CHANNELS = {
  all: {
    title: "最新文章",
    description: "技术教程、实用工具与折腾笔记。",
    href: "/",
  },
  tutorials: {
    title: "教程",
    description: "从操作步骤到实战经验，一起把技术用起来。",
    href: "/tutorials",
  },
  notes: {
    title: "随笔",
    description: "记录学习、探索与日常思考。",
    href: "/notes",
  },
  projects: {
    title: "开源项目",
    description: "开源工具、项目实践与部署笔记。",
    href: "/projects",
  },
  videos: {
    title: "视频",
    description: "实用技术与操作教程，跟着视频一起动手。",
    href: "/videos",
  },
  resources: {
    title: "免费资源",
    description: "免费软件、开源项目与实用工具，按需探索。",
    href: "/resources",
  },
  "member-videos": {
    title: "会员视频",
    description: "标记为 VIP 的视频教程与实战内容。",
    href: "/member-videos",
  },
} as const;
export function contentKind(
  post: Pick<CatalogItem, "category" | "tags" | "details">,
): "article" | "video" | "resource" | "project" {
  const explicit = post.details?.kind;
  if (explicit && explicit !== "auto") return explicit;
  const labels = [post.category, ...post.tags].map((v) =>
    v.trim().toLowerCase(),
  );
  if (
    labels.some((v) =>
      ["视频", "视频教程", "youtube视频", "video", "videos"].includes(v),
    )
  )
    return "video";
  if (
    labels.some((v) =>
      ["开源项目", "开源", "open source", "opensource"].includes(v),
    )
  )
    return "project";
  if (
    labels.some((v) =>
      ["免费资源", "资源", "resource", "resources"].includes(v),
    )
  )
    return "resource";
  return "article";
}
export function selectChannel<T extends CatalogItem>(
  posts: T[],
  channel: Channel,
): T[] {
  return posts.filter((p) => {
    const labels = [p.category, ...p.tags].map((v) => v.trim().toLowerCase());
    const kind = contentKind(p);
    const video = kind === "video";
    if (channel === "tutorials")
      return labels.some((v) =>
        ["教程", "技术教程", "tutorial", "tutorials"].includes(v),
      );
    if (channel === "notes")
      return labels.some((v) => ["随笔", "笔记", "notes"].includes(v));
    if (channel === "projects") return kind === "project";
    if (channel === "videos") return video;
    if (channel === "member-videos") return video && p.isVip;
    if (channel === "resources")
      return (
        !p.isVip &&
        (kind === "resource" ||
          (p.details?.kind !== "article" &&
            (!p.details?.kind || p.details.kind === "auto") &&
            labels.includes("开源")))
      );
    return true;
  });
}
export function searchPosts<T extends CatalogItem>(
  posts: T[],
  query: string,
): T[] {
  const q = query.trim().toLowerCase();
  return q
    ? posts.filter((p) =>
        [p.title, p.description, p.category, ...p.tags].some((v) =>
          v.toLowerCase().includes(q),
        ),
      )
    : posts;
}
