"use client";
import { useEffect, useState } from "react";
import type { UploadedFile } from "./FileUploader";
export function FileManagement() {
  const [files, setFiles] = useState<UploadedFile[]>([]),
    [revision, setRevision] = useState(0),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch("/api/files", { cache: "no-store" })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "加载失败");
        if (active) setFiles(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [revision]);
  async function remove(f: UploadedFile) {
    if (!window.confirm("确认删除文件“" + f.name + "”？删除后无法恢复。"))
      return;
    setBusy(true);
    setError("");
    try {
      const r = await fetch(f.url, { method: "DELETE" }),
        d = await r.json();
      if (!r.ok) throw new Error(d.error || "删除失败");
      setRevision((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="file-management">
      <p>
        显示最近 100
        个文件。文章正在引用的文件不能直接删除，请先移除文章中的链接并保存。
      </p>
      <p>
        “未绑定”文件仅管理员可见；咨询截图始终按咨询归属授权。删除咨询截图前请确认记录保留需要。
      </p>
      {error && (
        <p className="save-error" role="alert">
          {error}
        </p>
      )}
      {loading && <p role="status">正在加载…</p>}
      {!loading && !files.length && <p>还没有上传文件。</p>}
      <div className="managed-files">
        {files.map((f) => (
          <article className="reader-card" key={f.id}>
            <h2>{f.name}</h2>
            <p>
              {f.size >= 1024 * 1024
                ? (f.size / 1024 / 1024).toFixed(1) + " MB"
                : Math.ceil(f.size / 1024) + " KB"}{" "}
              ·{" "}
              {f.status === "pending"
                ? "未完成"
                : f.purpose === "ticket"
                  ? "咨询截图"
                  : f.postSlug
                    ? "文章：" + f.postSlug
                    : "未绑定文章"}
            </p>
            <div className="content-actions">
              {f.status === "ready" && (
                <a
                  className="btn"
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  查看文件
                </a>
              )}
              <button
                className="secondary-button"
                disabled={busy}
                onClick={() => remove(f)}
              >
                删除文件
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
