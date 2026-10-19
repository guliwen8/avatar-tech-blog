import type { AccessPolicy } from "./access";
export function readListState(params: URLSearchParams) {
  const raw = params.get("page") || "1";
  return {
    query: (params.get("q") || "").slice(0, 200),
    category: params.get("category") || "全部",
    page: /^\d{1,7}$/.test(raw) ? Math.max(1, Number(raw)) : 1,
  };
}
export function listStateUrl(
  current: string,
  state: { query: string; category: string; page: number },
) {
  const url = new URL(current);
  for (const [key, value] of [
    ["q", state.query],
    ["category", state.category === "全部" ? "" : state.category],
    ["page", state.page > 1 ? String(state.page) : ""],
  ]) {
    if (value) url.searchParams.set(key, value);
    else url.searchParams.delete(key);
  }
  return url.pathname + url.search + url.hash;
}
export function searchablePost(
  post: {
    title: string;
    description: string;
    category: string;
    tags: string[];
    content: string;
    details?: { access?: AccessPolicy };
  },
  query: string,
  bodyReadable: boolean,
) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (
    [post.title, post.description, post.category, ...post.tags].some((value) =>
      value.toLowerCase().includes(q),
    )
  )
    return true;
  return bodyReadable && post.content.toLowerCase().includes(q);
}
