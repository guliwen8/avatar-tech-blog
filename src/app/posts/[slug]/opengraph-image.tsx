import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getPost } from "@/server/repo";

/**
 * 文章社交分享图（1200×630）。
 *
 * 为什么不复用封面：
 * - 封面是 16:9 纯插画，没有文字；分享到微信/X 时无法辨识是哪一篇。
 * - 这里用代码渲染标题，保证中文清晰（图像模型画中文字会糊）。
 *
 * 字体：next/og 的 Satori 不含中文字形，必须显式加载 CJK 字体，
 * 否则标题会渲染成方块。字体文件由 next.config.mjs 的
 * outputFileTracingIncludes 保证进入 standalone 部署包。
 */

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "阿凡达的技术博客 · 文章封面";

const SITE = "阿凡达的技术博客";
const ACCENT = "#24a5db";

let fontCache: ArrayBuffer | null = null;

async function loadCjkFont(): Promise<ArrayBuffer | null> {
  if (fontCache) return fontCache;
  try {
    const file = await readFile(
      path.join(process.cwd(), "src/assets/og-cjk.otf"),
    );
    fontCache = file.buffer.slice(
      file.byteOffset,
      file.byteOffset + file.byteLength,
    ) as ArrayBuffer;
    return fontCache;
  } catch {
    // 字体缺失时降级：不阻塞分享图生成，中文可能显示为方块
    return null;
  }
}

/** 标题过长时截断，避免 3 行溢出。 */
function clip(text: string, max: number): string {
  const t = text.trim();
  return t.length <= max ? t : t.slice(0, max - 1) + "…";
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPost(slug);
  const font = await loadCjkFont();

  const title = clip(post?.title || SITE, 34);
  const desc = clip(post?.description || "", 62);
  const category = post?.category || "";
  const date = post?.date || "";
  const tags = (post?.tags || []).slice(0, 3);

  const fonts = font
    ? [{ name: "Noto Sans SC", data: font, weight: 400 as const, style: "normal" as const }]
    : undefined;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #0b1620 0%, #12212e 55%, #0d1a26 100%)",
          color: "#f5f9fc",
          fontFamily: font ? "Noto Sans SC" : "sans-serif",
          position: "relative",
        }}
      >
        {/* 右上角装饰光晕 */}
        <div
          style={{
            position: "absolute",
            top: -180,
            right: -140,
            width: 520,
            height: 520,
            borderRadius: 260,
            background: "radial-gradient(circle, rgba(36,165,219,0.30) 0%, rgba(36,165,219,0) 70%)",
            display: "flex",
          }}
        />

        {/* 顶部：站点标识 */}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 12,
              height: 40,
              borderRadius: 6,
              background: ACCENT,
              display: "flex",
            }}
          />
          <div style={{ fontSize: 28, color: "#9fb3c4", letterSpacing: 1 }}>
            {SITE}
          </div>
        </div>

        {/* 中部：标题 + 摘要 */}
        <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
          <div
            style={{
              fontSize: title.length > 20 ? 62 : 74,
              lineHeight: 1.22,
              fontWeight: 700,
              display: "flex",
              letterSpacing: -0.5,
            }}
          >
            {title}
          </div>
          {desc ? (
            <div
              style={{
                fontSize: 28,
                lineHeight: 1.5,
                color: "#8ba0b3",
                display: "flex",
              }}
            >
              {desc}
            </div>
          ) : null}
        </div>

        {/* 底部：分类 / 日期 / 标签 */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 18,
            fontSize: 24,
            color: "#7d93a6",
          }}
        >
          {category ? (
            <div
              style={{
                padding: "8px 20px",
                borderRadius: 999,
                background: "rgba(36,165,219,0.16)",
                color: ACCENT,
                display: "flex",
              }}
            >
              {clip(category, 12)}
            </div>
          ) : null}
          {date ? <div style={{ display: "flex" }}>{date}</div> : null}
          {tags.map((t) => (
            <div key={t} style={{ display: "flex" }}>
              #{clip(String(t), 10)}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
