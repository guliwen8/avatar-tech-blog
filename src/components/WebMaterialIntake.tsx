"use client";
import { useEffect, useRef, useState } from "react";
interface Entry {
  url: string;
  title: string;
  date?: string;
}
interface Result {
  slug?: string;
  url: string;
  reused?: boolean;
  generated?: boolean;
  error?: string;
}
export function WebMaterialIntake() {
  const [url, setUrl] = useState(""),
    [kind, setKind] = useState("article"),
    [entries, setEntries] = useState<Entry[]>([]),
    [feedTitle, setFeedTitle] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [results, setResults] = useState<Result[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  async function request(body: unknown) {
    const r = await fetch("/api/admin/web-imports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.current?.signal,
    });
    const d = await r.json();
    if (!r.ok) throw Error(d.error || "采集失败");
    return d;
  }
  async function inspect() {
    setBusy(true);
    setMessage("正在读取订阅列表…");
    setEntries([]);
    setSelected([]);
    controller.current = new AbortController();
    try {
      const r = await request({ action: "feed", url });
      setEntries(r.items);
      setFeedTitle(r.title);
      setMessage("请选择最多 3 篇文章，再采集正文；读取列表不会调用 AI。");
    } catch (e) {
      setMessage(
        e instanceof Error && e.name === "AbortError"
          ? "已停止"
          : e instanceof Error
            ? e.message
            : "读取失败",
      );
    } finally {
      setBusy(false);
    }
  }
  async function collect(generate: boolean) {
    const urls = kind === "article" ? [url] : selected;
    if (!urls.length) return;
    setBusy(true);
    setResults([]);
    controller.current = new AbortController();
    for (let i = 0; i < urls.length; i++) {
      if (controller.current.signal.aborted) break;
      setMessage(`正在处理 ${i + 1}/${urls.length}，请稍候…`);
      try {
        const r = await request({
          action: "collect",
          url: urls[i],
          generate,
          ...(kind === "feed" ? { feedUrl: url } : {}),
        });
        setResults((old) => [...old, { ...r, url: urls[i] }]);
      } catch (e) {
        if (controller.current.signal.aborted) break;
        setResults((old) => [
          ...old,
          { url: urls[i], error: e instanceof Error ? e.message : "采集失败" },
        ]);
      }
    }
    setBusy(false);
    setMessage(
      controller.current.signal.aborted
        ? "已停止后续采集；已经保存的素材草稿会保留。"
        : "处理完成，请打开素材草稿核对原文、来源与候选稿。",
    );
  }
  return (
    <section className="panel web-import-panel" aria-label="网页与订阅采集">
      <h2>网页与 RSS → 素材草稿</h2>
      <p>
        输入文章链接，或先读取 RSS / Atom
        列表再选择文章。采集保留原文与出处，正式正文和发布状态不自动更新。
      </p>
      <div className="editorial-controls">
        <label htmlFor="web-source-kind">来源类型</label>
        <select
          id="web-source-kind"
          disabled={busy}
          value={kind}
          onChange={(e) => {
            setKind(e.target.value);
            setEntries([]);
            setSelected([]);
          }}
        >
          <option value="article">单篇网页文章</option>
          <option value="feed">网站 / RSS / Atom</option>
        </select>
      </div>
      <div className="form-row">
        <label htmlFor="web-source-url">
          {kind === "feed" ? "网站首页或订阅地址" : "文章地址"}
        </label>
        <input
          id="web-source-url"
          type="url"
          maxLength={2000}
          value={url}
          disabled={busy}
          onChange={(e) => {
            setUrl(e.target.value);
            setEntries([]);
            setSelected([]);
          }}
          placeholder="https://…"
        />
      </div>
      {kind === "feed" && (
        <>
          <button
            className="btn btn-ghost"
            disabled={busy || !url.trim()}
            onClick={inspect}
          >
            读取订阅文章
          </button>
          {entries.length > 0 && (
            <fieldset className="web-feed-list">
              <legend>{feedTitle}（最多选择 3 篇）</legend>
              {entries.map((entry) => (
                <label className="web-feed-item" key={entry.url}>
                  <input
                    type="checkbox"
                    checked={selected.includes(entry.url)}
                    disabled={
                      busy ||
                      (selected.length >= 3 && !selected.includes(entry.url))
                    }
                    onChange={(e) =>
                      setSelected((old) =>
                        e.target.checked
                          ? [...old, entry.url]
                          : old.filter((x) => x !== entry.url),
                      )
                    }
                  />
                  <span>
                    {entry.title}
                    <small>{entry.url}</small>
                  </span>
                </label>
              ))}
            </fieldset>
          )}
        </>
      )}
      <p className="hint">
        只读取公网 HTTPS，单页最多 2 MB、正文最多 40000
        字符。动态加载、登录或付费页面可能无法提取，可回到文字入口粘贴。相同来源复用已有文章，不覆盖正文。
      </p>
      <div className="form-actions">
        <button
          className="btn btn-primary"
          disabled={busy || (kind === "feed" ? !selected.length : !url.trim())}
          onClick={() => collect(true)}
        >
          采集并生成候选稿
        </button>
        <button
          className="btn btn-ghost"
          disabled={busy || (kind === "feed" ? !selected.length : !url.trim())}
          onClick={() => collect(false)}
        >
          仅采集正文
        </button>
        {busy && (
          <button
            className="btn btn-ghost"
            onClick={() => controller.current?.abort()}
          >
            停止采集
          </button>
        )}
      </div>
      <p className="hint">
        “采集并生成候选稿”会将原文发送给已配置的 AI
        服务，可能计费；“仅采集正文”和读取订阅列表不调用 AI。中断不撤销已受理的
        API 费用。
      </p>
      <p role="status">{message}</p>
      <div className="import-job-list">
        {results.map((r, i) => (
          <article className="import-job" key={i}>
            <strong>
              {r.reused
                ? "来源已采集，复用现有文章"
                : r.generated
                  ? "候选稿待审核"
                  : r.slug
                    ? "素材草稿已保存"
                    : "未完成"}
            </strong>
            <p className="import-source-url">{r.url}</p>
            {r.error && <p className="import-job-error">{r.error}</p>}
            {r.slug && (
              <a
                className="btn btn-primary"
                href={"/admin/posts/edit?slug=" + encodeURIComponent(r.slug)}
              >
                {r.reused ? "查看已有文章" : "打开并审核草稿"}
              </a>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
