import { sourceUrl } from "./video-http.mjs";
export function normalizeWebUrl(raw) {
  if (typeof raw !== "string" || raw.length > 2000)
    throw Error("请填写有效链接（最多 2000 字符）");
  const u = sourceUrl(raw);
  for (const k of [...u.searchParams.keys()])
    if (/^utm_|^(fbclid|gclid)$/i.test(k)) u.searchParams.delete(k);
  return u.href;
}
