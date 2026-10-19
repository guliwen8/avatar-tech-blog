"use client";
import { useEffect, useRef, useState } from "react";
import {
  EDITORIAL_TEMPLATES,
  normalizeEditorial,
  templateSkeleton,
  editorialChecks,
  type EditorialData,
  type EditorialCandidate,
  type EditorialTemplate,
  type EditorialStyle,
} from "@/lib/editorial";
async function call(body: unknown, signal?: AbortSignal) {
  const r = await fetch("/api/admin/editorial", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || "处理失败");
  return data;
}
const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function EditorialWorkbench({
  value,
  current,
  onChange,
  onAdopt,
}: {
  value?: EditorialData;
  current: EditorialCandidate;
  onChange: (v: EditorialData) => void;
  onAdopt: (v: EditorialCandidate) => void;
}) {
  const data = normalizeEditorial(value);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [reviewed, setReviewed] = useState(false),
    [doc, setDoc] = useState(""),
    [previewError, setPreviewError] = useState("");
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const candidate = data.candidate;
  const warnings = [
    ...new Set([
      ...data.warnings,
      ...editorialChecks(
        data.source + "\n" + data.sources,
        candidate?.content || "",
      ),
    ]),
  ];
  function change(patch: Partial<EditorialData>) {
    setReviewed(false);
    onChange({ ...data, ...patch });
  }
  function editCandidate(patch: Partial<EditorialCandidate>) {
    change({
      candidate: {
        title: candidate?.title ?? current.title,
        description: candidate?.description ?? current.description,
        content: candidate?.content || "",
        ...patch,
      },
    });
  }
  async function generate() {
    setBusy(true);
    setError("");
    setReviewed(false);
    const ac = new AbortController();
    controller.current = ac;
    try {
      const result = await call(
        {
          action: "generate",
          source: data.source,
          sources: data.sources,
          template: data.template,
          style: data.style,
        },
        ac.signal,
      );
      onChange({
        ...data,
        candidate: {
          title: result.title,
          description: result.description,
          content: result.content,
        },
        warnings: result.warnings || [],
      });
    } catch (e) {
      setError(
        ac.signal.aborted
          ? "生成已取消，原稿保持不变"
          : e instanceof Error
            ? e.message
            : "生成失败",
      );
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    setDoc("");
    setPreviewError("");
    if (!candidate?.content) return;
    const ac = new AbortController();
    let active = true;
    const timer = setTimeout(() => {
      call({ action: "preview", content: candidate.content }, ac.signal)
        .then((result) => {
          if (!active) return;
          const styles = [
            ...document.querySelectorAll<HTMLLinkElement>(
              'link[rel="stylesheet"]',
            ),
          ]
            .map((l) => `<link rel="stylesheet" href="${escape(l.href)}">`)
            .join("");
          setDoc(
            `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<style>body{margin:0;background:#fff} .article-detail{padding:24px;margin:0;border:0;box-shadow:none;min-width:0}img{max-width:100%}pre{overflow-x:auto}</style></head><body><article class="article article-detail"><h1>${escape(candidate.title)}</h1>${candidate.description ? `<p class="article-summary">${escape(candidate.description)}</p>` : ""}<div class="prose">${result.html}</div></article></body></html>`,
          );
        })
        .catch((e) => {
          if (active && !ac.signal.aborted) setPreviewError(e.message);
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
      ac.abort();
    };
  }, [candidate?.content, candidate?.title, candidate?.description]);
  return (
    <section className="editorial-workbench" aria-label="素材整理工作台">
      <div className="editorial-heading">
        <div>
          <h2>素材整理工作台</h2>
          <a href="/admin/imports">素材采集入口</a>
          <p>原始素材单独保留。AI 只生成候选稿，采用后先存草稿。</p>
        </div>
        <a href="/admin/editorial" target="_blank" rel="noopener noreferrer">
          AI 服务配置 ↗
        </a>
      </div>
      <div className="editorial-controls">
        <label htmlFor="editorial-template">文章模板</label>
        <select
          id="editorial-template"
          value={data.template}
          disabled={busy}
          onChange={(e) =>
            change({ template: e.target.value as EditorialTemplate })
          }
        >
          {Object.entries(EDITORIAL_TEMPLATES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
        <label htmlFor="editorial-style">整理方式</label>
        <select
          id="editorial-style"
          value={data.style || "auto"}
          disabled={busy}
          onChange={(e) => change({ style: e.target.value as EditorialStyle })}
        >
          <option value="auto">自动（短素材简洁整理）</option>
          <option value="concise">简洁整理</option>
          <option value="complete">完整教程</option>
        </select>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy || !current.content}
          onClick={() => {
            if (
              data.source &&
              !window.confirm(
                "替换素材区内容？已保存到数据库的版本在保存文章前不会变化。",
              )
            )
              return;
            change({ source: current.content });
          }}
        >
          从当前正文导入素材
        </button>
      </div>
      <div className="editorial-columns">
        <div className="editorial-source">
          <label htmlFor="editorial-source">原始素材（仅后台可见）</label>
          <textarea
            id="editorial-source"
            value={data.source}
            maxLength={40000}
            disabled={busy}
            onChange={(e) => change({ source: e.target.value })}
            placeholder="粘贴杂乱笔记、文章素材。不会自动改写或发布。"
          />
          <label htmlFor="editorial-sources">参考来源（选填）</label>
          <textarea
            id="editorial-sources"
            value={data.sources}
            maxLength={4000}
            disabled={busy}
            onChange={(e) => change({ sources: e.target.value })}
            placeholder="填写来源名称及链接，AI 不会自行访问这些网址。"
          />
          <div className="form-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !data.source.trim()}
              onClick={generate}
            >
              {busy ? "AI 整理中…" : "AI 整理成草稿"}
            </button>
            {busy && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => controller.current?.abort()}
              >
                取消生成
              </button>
            )}
            <button
              type="button"
              className="btn btn-ghost"
              disabled={busy}
              onClick={() => {
                if (
                  candidate?.content &&
                  !window.confirm(
                    "用空白结构替换候选稿？原始素材与当前正文不受影响。",
                  )
                )
                  return;
                change({
                  candidate: {
                    title: current.title,
                    description: current.description,
                    content: templateSkeleton(data.template),
                  },
                  warnings: [],
                });
              }}
            >
              插入模板结构
            </button>
          </div>
          <p className="hint">
            点击 AI 整理会将素材发送给你配置的服务商，可能产生 API
            费用。素材和候选稿随文章保存，不会自动上传或自动保存。
          </p>
        </div>
        <div className="editorial-candidate">
          <label htmlFor="editorial-title">候选标题</label>
          <input
            id="editorial-title"
            value={candidate?.title || ""}
            disabled={busy}
            maxLength={200}
            onChange={(e) => editCandidate({ title: e.target.value })}
          />
          <label htmlFor="editorial-description">候选摘要</label>
          <input
            id="editorial-description"
            value={candidate?.description || ""}
            disabled={busy}
            maxLength={500}
            onChange={(e) => editCandidate({ description: e.target.value })}
          />
          <label htmlFor="editorial-content">
            候选正文（Markdown，可修改）
          </label>
          <textarea
            id="editorial-content"
            value={candidate?.content || ""}
            disabled={busy}
            maxLength={50000}
            onChange={(e) => editCandidate({ content: e.target.value })}
            placeholder="AI 结果或模板结构会出现在这里，当前文章正文不会被覆盖。"
          />
          <p className="hint">
            自动检查覆盖代码、链接和版本号，其他事实仍需人工核对；AI
            不保证语义完全一致，未亲测的内容不能写成“亲测”。
          </p>
          {candidate && warnings.length > 0 && (
            <div className="editorial-warnings" role="status">
              <strong>待核对事项</strong>
              <ul>
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            </div>
          )}
          <label className="editorial-review">
            <input
              type="checkbox"
              checked={reviewed}
              disabled={busy || !candidate}
              onChange={(e) => setReviewed(e.target.checked)}
            />
            我已核对事实、命令、链接及来源，确认采用
          </label>
          <button
            type="button"
            className="btn btn-primary"
            disabled={
              busy ||
              !reviewed ||
              !candidate?.title.trim() ||
              !candidate?.content.trim()
            }
            onClick={() => candidate && onAdopt(candidate)}
          >
            采用此稿并设为草稿
          </button>
        </div>
      </div>
      {error && (
        <p className="save-error" role="alert">
          {error}
        </p>
      )}
      <div className="editorial-preview">
        <h3>候选稿页面预览</h3>
        {previewError ? (
          <p role="alert">预览失败：{previewError}</p>
        ) : doc ? (
          <iframe
            title="候选稿页面预览"
            sandbox="allow-same-origin"
            referrerPolicy="no-referrer"
            srcDoc={doc}
          />
        ) : (
          <p>
            {candidate?.content
              ? "正在生成预览…"
              : "候选稿生成后，这里会按博客实际 Markdown 样式展示。"}
          </p>
        )}
      </div>
    </section>
  );
}
