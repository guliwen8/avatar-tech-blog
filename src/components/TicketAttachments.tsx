"use client";
import { useEffect, useState } from "react";
import { FileUploader, type UploadedFile } from "./FileUploader";
export function TicketAttachments({
  id,
  closed,
  admin,
  onChanged,
}: {
  id: string;
  closed: boolean;
  admin: boolean;
  onChanged: () => void;
}) {
  const [files, setFiles] = useState<UploadedFile[]>([]),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    fetch("/api/files?ticketId=" + encodeURIComponent(id), {
      cache: "no-store",
    })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "截图加载失败");
        if (active) setFiles(d);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [id]);
  async function remove(file: UploadedFile) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(file.url, { method: "DELETE" }),
        d = await r.json();
      if (!r.ok) throw new Error(d.error || "删除失败");
      setFiles((list) => list.filter((f) => f.id !== file.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "连接失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="ticket-attachments" aria-label="咨询截图">
      <h3>
        问题截图 <small>{files.length} / 9</small>
      </h3>
      <p className="content-note">
        截图仅本人和后台管理员可见，请先遮住密码、密钥和无关个人信息。
      </p>
      {!closed && files.length < 9 && (
        <FileUploader
          purpose="ticket"
          ticketId={id}
          label="添加咨询截图"
          accept=".png,.jpg,.jpeg,.webp"
          maxMB={5}
          onUploaded={() => onChanged()}
        />
      )}
      {!files.length && <p className="content-note">暂无截图。</p>}
      <div className="attachment-grid">
        {files.map((f) => (
          <figure key={f.id}>
            <a href={f.url} target="_blank" rel="noopener noreferrer">
              <img src={f.url} alt={f.name} loading="lazy" />
            </a>
            <figcaption>
              {f.name}
              <small>
                {f.uploadedBy === "admin" ? "站长上传" : "用户上传"}
              </small>
            </figcaption>
            {!closed && (admin || f.uploadedBy === "member") && (
              <button
                type="button"
                className="secondary-button"
                disabled={busy}
                onClick={() => remove(f)}
              >
                删除截图
              </button>
            )}
          </figure>
        ))}
      </div>
      {error && (
        <p role="alert" className="save-error">
          {error}
        </p>
      )}
    </section>
  );
}
