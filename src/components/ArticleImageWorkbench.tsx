"use client";
import { useEffect, useRef, useState } from "react";
import {
  imageSuggestions,
  imagePrompt,
  normalizeArticleImage,
  type ArticleImage,
} from "@/lib/article-images";
import type { EditorialCandidate } from "@/lib/editorial";
export function ArticleImageWorkbench({
  article,
  images,
  disabled,
  onImages,
  onCover,
  onInsert,
  onBusy,
}: {
  article: EditorialCandidate;
  images: ArticleImage[];
  disabled: boolean;
  onImages: (images: ArticleImage[]) => void;
  onCover: (image: ArticleImage) => boolean;
  onInsert: (image: ArticleImage) => void;
  onBusy: (busy: boolean) => void;
}) {
  const plans = imageSuggestions(article);
  const [selected, setSelected] = useState(0),
    [customPrompt, setCustomPrompt] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  const controller = useRef<AbortController | null>(null),
    running = useRef(false);
  useEffect(() => () => controller.current?.abort(), []);
  const plan = plans[selected] || plans[0],
    prompt = customPrompt ?? imagePrompt(article, plan);
  async function generate() {
    if (running.current) return;
    if (
      !window.confirm(
        "将向 MiniMax 发送当前图片描述并生成一张图片，可能消耗额度或产生 API 费用。确认生成？",
      )
    )
      return;
    running.current = true;
    setBusy(true);
    onBusy(true);
    setError("");
    setNotice("");
    const ac = new AbortController();
    controller.current = ac;
    try {
      const r = await fetch("/api/admin/article-images", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...plan, prompt }),
        signal: ac.signal,
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "生成失败");
      onImages([...images, normalizeArticleImage(d.image)]);
      setNotice(
        "图片已保存到文件管理。请预览并采用，保存文章后才会绑定到文章。",
      );
    } catch (e) {
      setError(
        ac.signal.aborted
          ? "已停止等待，文章保持不变；服务商已开始的生成可能仍会计费。可在文件管理查看已保存图片。"
          : e instanceof Error
            ? e.message
            : "生成失败",
      );
    } finally {
      running.current = false;
      setBusy(false);
      onBusy(false);
    }
  }
  return (
    <section className="article-image-workbench" aria-label="文章封面与配图">
      <h3>文章封面与配图</h3>
      <p>
        根据候选稿生成图片。先预览，再采用；正文插图标明为 AI
        示意图，不替代真实操作截图。
      </p>
      <div className="form-row">
        <label htmlFor="article-image-plan">图片位置</label>
        <select
          id="article-image-plan"
          disabled={disabled || busy}
          value={selected}
          onChange={(e) => {
            setSelected(Number(e.target.value));
            setCustomPrompt(null);
          }}
        >
          {plans.map((p, i) => (
            <option value={i} key={i}>
              {p.role === "cover" ? "文章封面" : `正文配图 · ${p.section}`}
            </option>
          ))}
        </select>
      </div>
      <div className="form-row">
        <label htmlFor="article-image-prompt">图片描述（可修改）</label>
        <textarea
          id="article-image-prompt"
          maxLength={1500}
          value={prompt}
          disabled={disabled || busy}
          onChange={(e) => setCustomPrompt(e.target.value)}
        />
      </div>
      <div className="form-actions">
        <button
          type="button"
          className="btn btn-primary"
          disabled={
            disabled ||
            busy ||
            !article.title.trim() ||
            !article.content.trim() ||
            !prompt.trim() ||
            images.length >= 12
          }
          onClick={generate}
        >
          {busy ? "图片生成中…" : "生成一张图片"}
        </button>
        {busy && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => controller.current?.abort()}
          >
            停止等待
          </button>
        )}
        <a href="/admin/editorial" target="_blank" rel="noopener noreferrer">
          图片服务配置 ↗
        </a>
      </div>
      <p className="hint">
        每张单独生成，可修改描述后重新生成。最多保留 12 张候选图片。描述会发送给
        MiniMax；生成失败不自动重试。
      </p>
      {error && (
        <p role="alert" className="save-error">
          {error}
        </p>
      )}
      {notice && <p role="status">{notice}</p>}
      <div className="article-image-grid">
        {images.map((image) => (
          <figure key={image.id}>
            <img src={image.url} alt={image.caption} loading="lazy" />
            <figcaption>
              {image.role === "cover" ? "封面" : "正文"} · {image.caption}
              <span>AI 生成示意图</span>
            </figcaption>
            <div className="form-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={disabled || busy}
                onClick={() => {
                  if (image.role === "cover") {
                    if (!onCover(image)) return;
                  } else onInsert(image);
                  setNotice(
                    image.role === "cover"
                      ? "封面已填入文章封面栏，文章已设为草稿，请保存。"
                      : "图片已插入候选稿，请预览并采用候选稿后保存。",
                  );
                }}
              >
                {image.role === "cover" ? "采用为封面" : "插入候选稿"}
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={disabled || busy}
                onClick={() => {
                  onImages(images.filter((x) => x.id !== image.id));
                  setNotice(
                    "已从候选列表移除；文件仍保存在文件管理，文章中已采用的链接不变。",
                  );
                }}
              >
                移出候选
              </button>
            </div>
          </figure>
        ))}
      </div>
    </section>
  );
}
