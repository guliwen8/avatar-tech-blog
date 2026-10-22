import { JSDOM, VirtualConsole } from "jsdom";
import { Readability } from "@mozilla/readability";
import TurndownService from "turndown";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { publicRequest } from "./video-http.mjs";
import { normalizeWebUrl } from "./web-url.mjs";
export { normalizeWebUrl } from "./web-url.mjs";
export function extractArticle(html, url) {
  if (html.length > 2 * 1024 * 1024) throw Error("网页内容超过 2 MB");
  const dom = new JSDOM(html, { url, virtualConsole: new VirtualConsole() });
  try {
    const doc = dom.window.document;
    if (
      /^(just a moment|access denied|verify you are human|attention required|403 forbidden)|人机验证|安全验证|访问受限|请先登录/i.test(
        doc.title.trim(),
      )
    )
      throw Error("来源返回验证或登录页面，没有取得文章正文，请手动粘贴");
    doc
      .querySelectorAll(
        "script,style,noscript,iframe,form,nav,footer,header,aside,svg,canvas,video,audio,img,picture",
      )
      .forEach((el) => el.remove());
    if (doc.querySelectorAll("*").length > 20000)
      throw Error("网页结构过大，请手动粘贴正文");
    const article = new Readability(doc, {
      charThreshold: 120,
      maxElemsToParse: 20000,
      disableJSONLD: true,
    }).parse();
    if (!article?.content || (article.textContent || "").trim().length < 120)
      throw Error(
        "没有提取到足够的文章正文，可能需要登录、动态加载或不是文章页，请手动粘贴",
      );
    const body = new JSDOM(article.content, {
      url,
      virtualConsole: new VirtualConsole(),
    });
    try {
      body.window.document.querySelectorAll("a").forEach((a) => {
        try {
          const u = new URL(a.getAttribute("href") || "", url);
          if (!["https:", "http:"].includes(u.protocol))
            a.removeAttribute("href");
          else a.setAttribute("href", u.href);
        } catch {
          a.removeAttribute("href");
        }
      });
      const converter = new TurndownService({
        headingStyle: "atx",
        codeBlockStyle: "fenced",
        fence: "```",
      });
      converter.remove(["script", "style", "img", "iframe", "form"]);
      converter.addRule("tables", {
        filter: "table",
        replacement: (_c, node) => {
          const rows = [...node.querySelectorAll("tr")].map((row) =>
            [...row.querySelectorAll("th,td")].map((cell) =>
              cell.textContent
                .trim()
                .replace(/\|/g, "\\|")
                .replace(/\s+/g, " "),
            ),
          );
          if (!rows.length) return "";
          const count = Math.max(...rows.map((r) => r.length));
          const line = (row) =>
            "| " +
            Array.from({ length: count }, (_, i) => row[i] || "").join(" | ") +
            " |";
          return (
            "\n\n" +
            line(rows[0]) +
            "\n" +
            line(Array(count).fill("---")) +
            "\n" +
            rows.slice(1).map(line).join("\n") +
            "\n\n"
          );
        },
      });
      converter.addRule("code-fences", {
        filter: "pre",
        replacement: (_content, node) => {
          const code = node.querySelector("code") || node;
          const language =
            (code.getAttribute("class") || "").match(
              /language-([\w-]+)/,
            )?.[1] || "";
          const text = code.textContent.replace(/\n$/, "");
          const fence = "`".repeat(
            Math.max(3, ...(text.match(/`+/g) || []).map((x) => x.length + 1)),
          );
          return (
            "\n\n" + fence + language + "\n" + text + "\n" + fence + "\n\n"
          );
        },
      });
      const content = converter.turndown(body.window.document.body).trim();
      if (content.length > 40000)
        throw Error("提取正文超过 40000 字符，请分段粘贴");
      return {
        title: (article.title || doc.title || "网页素材").slice(0, 200),
        content,
        url,
        byline: (article.byline || "").slice(0, 200),
      };
    } finally {
      body.window.close();
    }
  } finally {
    dom.window.close();
  }
}
const list = (x) => (x == null ? [] : Array.isArray(x) ? x : [x]);
const decode = (x) =>
  x
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(x[0-9a-f]+|[0-9]+);/gi, (raw, code) => {
      const value =
        code[0].toLowerCase() === "x"
          ? parseInt(code.slice(1), 16)
          : parseInt(code, 10);
      return value > 0 &&
        value <= 0x10ffff &&
        !(value >= 0xd800 && value <= 0xdfff)
        ? String.fromCodePoint(value)
        : raw;
    });
const scalar = (x) =>
  typeof x === "string"
    ? x
    : typeof x === "number"
      ? String(x)
      : typeof x?.["#text"] === "string"
        ? x["#text"]
        : "";
export function parseFeed(xml, url, options = {}) {
  if (xml.length > 2 * 1024 * 1024) throw Error("订阅内容超过 2 MB");
  if (/<!DOCTYPE|<!ENTITY/i.test(xml))
    throw Error("不支持带 DOCTYPE 或实体声明的订阅");
  if (XMLValidator.validate(xml) !== true) throw Error("RSS / Atom 格式无效");
  const feed = new XMLParser({
    ignoreAttributes: false,
    processEntities: false,
    parseTagValue: false,
    trimValues: true,
    removeNSPrefix: true,
  }).parse(xml);
  const channel = feed.rss?.channel || feed.feed;
  if (!channel) throw Error("未识别到 RSS 或 Atom 订阅");
  const entries = list(channel.item || channel.entry);
  const seen = new Set(),
    items = [];
  for (const entry of entries.slice(0, 100)) {
    const link =
      typeof entry.link === "string"
        ? entry.link
        : list(entry.link).find(
            (x) => !x?.["@_rel"] || x["@_rel"] === "alternate",
          )?.["@_href"];
    if (!link) continue;
    try {
      const normalized = normalizeWebUrl(new URL(decode(link), url).href);
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      items.push({
        title:
          decode(scalar(entry.title))
            .replace(/<[^>]*>/g, "")
            .slice(0, 200) || "未命名文章",
        url: normalized,
        hasFullContent: !!scalar(entry.encoded || entry.content).trim(),
        ...(options.includeContent
          ? {
              fullContent: scalar(entry.encoded || entry.content),
              fullContentType: entry.encoded ? "html" : (entry.content?.["@_type"] || "text"),
              byline: scalar(entry.creator || entry.author?.name).slice(0, 200),
            }
          : {}),
        date: scalar(entry.pubDate || entry.published || entry.updated).slice(
          0,
          100,
        ),
      });
      if (items.length >= 20) break;
    } catch {}
  }
  if (!items.length) throw Error("订阅中没有可采集的公网 HTTPS 文章链接");
  return {
    title: decode(scalar(channel.title)).slice(0, 200) || "RSS / Atom",
    url,
    items,
  };
}
export async function readWebSource(
  raw,
  kind,
  signal,
  fetcher = publicRequest,
  depth = 0,
) {
  const url = normalizeWebUrl(raw);
  const result = await fetcher(url, {
    signal,
    maxBytes: 2 * 1024 * 1024,
    timeoutMs: 25000,
    headers: {
      Accept: kind.startsWith("feed")
        ? "application/rss+xml, application/atom+xml, application/xml, text/xml"
        : "text/html, application/xhtml+xml",
    },
  });
  const finalUrl = normalizeWebUrl(result.finalUrl || url);
  const text = result.body.toString("utf8");
  if (kind.startsWith("feed")) {
    if (/<html\b|<!doctype\s+html/i.test(text)) {
      if (depth >= 1) throw Error("没有找到有效的 RSS / Atom，请填写订阅地址");
      const dom = new JSDOM(text, {
        url: finalUrl,
        virtualConsole: new VirtualConsole(),
      });
      let discovered;
      try {
        const candidates = [
          ...dom.window.document.querySelectorAll("link[rel~=alternate]"),
        ]
          .filter((n) => /application\/(rss|atom)\+xml/i.test(n.type))
          .map((n) => n.href)
          .filter((h) => {
            try {
              return (
                new URL(h).origin === new URL(finalUrl).origin &&
                !/comments/i.test(h)
              );
            } catch {
              return false;
            }
          });
        discovered =
          candidates[0] ||
          (new URL(finalUrl).pathname === "/"
            ? new URL("/feed/", finalUrl).href
            : undefined);
      } finally {
        dom.window.close();
      }
      if (!discovered || discovered === finalUrl)
        throw Error("首页未发现订阅，请填写 RSS / Atom 地址");
      return readWebSource(discovered, kind, signal, fetcher, depth + 1);
    }
    return parseFeed(text, finalUrl, { includeContent: kind === "feed-full" });
  }
  return extractArticle(text, finalUrl);
}

export async function readFeedArticle(
  feedUrl,
  articleUrl,
  signal,
  fetcher = publicRequest,
) {
  const feed = await readWebSource(feedUrl, "feed-full", signal, fetcher);
  const target = normalizeWebUrl(articleUrl);
  const item = feed.items.find((i) => i.url === target);
  if (!item) throw Error("所选文章已不在订阅列表，请刷新订阅后重选");
  if (!item.fullContent?.trim()) return null;
  const escape = (s) =>
    s.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const full =
    item.fullContentType === "text"
      ? "<p>" + escape(item.fullContent) + "</p>"
      : item.fullContent.trim().startsWith("&lt;")
        ? decode(item.fullContent)
        : item.fullContent;
  const result = extractArticle(
    "<html><head><title>" +
      escape(item.title) +
      "</title></head><body><article>" +
      full +
      "</article></body></html>",
    item.url,
  );
  return {
    ...result,
    byline: item.byline || result.byline,
    method: "feed-full",
    feedUrl: feed.url,
  };
}
