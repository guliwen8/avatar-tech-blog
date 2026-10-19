import type { Root, RootContent, Element } from "hast";
import type { VFile } from "vfile";
export interface TocItem {
  id: string;
  text: string;
  depth: number;
}
export interface ResourceLink {
  href: string;
  text: string;
  video: boolean;
}
function publicHttps(raw: string): URL | undefined {
  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    if (
      u.protocol !== "https:" ||
      u.username ||
      u.password ||
      host === "localhost" ||
      host.endsWith(".local") ||
      host.endsWith(".localhost") ||
      host.includes(":") ||
      /^\d+\.\d+\.\d+\.\d+$/.test(host)
    )
      return;
    return u;
  } catch {
    return;
  }
}
export function safeCover(raw?: string): string | undefined {
  if (!raw) return;
  if (
    /^\/uploads\/[a-zA-Z0-9_./%-]+\.(png|jpe?g|webp|gif|avif)$/i.test(raw) &&
    !raw.includes("..")
  )
    return raw;
  const u = publicHttps(raw);
  if (!u || /\/(admin|api)(\/|$)/i.test(u.pathname)) return;
  return u.href;
}
function textOf(node: RootContent): string {
  return node.type === "text"
    ? node.value
    : "children" in node
      ? node.children.map(textOf).join("")
      : "";
}
// 在渲染树上生成目录，避免用正则解析 Markdown 或破坏代码块中的标题。
export function readingStructure() {
  return (tree: Root, file: VFile) => {
    const toc: TocItem[] = [],
      resources: ResourceLink[] = [];
    const seen = new Set<string>();
    function visit(node: Root | RootContent) {
      if (node.type === "element") {
        const el = node as Element;
        if (/^h[2-4]$/.test(el.tagName)) {
          const id = `section-${toc.length + 1}`;
          el.properties.id = id;
          toc.push({ id, text: textOf(el), depth: Number(el.tagName[1]) });
        }
        if (el.tagName === "a" && typeof el.properties.href === "string") {
          const url = publicHttps(el.properties.href);
          if (url && !seen.has(url.href)) {
            seen.add(url.href);
            resources.push({
              href: url.href,
              text: textOf(el).trim() || url.hostname,
              video: /\.(mp4|webm)$/i.test(url.pathname),
            });
          }
        }
      }
      if ("children" in node) node.children.forEach(visit);
    }
    visit(tree);
    file.data.toc = toc;
    file.data.resources = resources;
  };
}
