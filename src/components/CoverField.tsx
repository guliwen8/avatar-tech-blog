"use client";
import { useRef, useState } from "react";

/**
 * 封面图输入。
 *
 * 三种方式任选：
 * 1. 粘贴图片地址
 * 2. 点「上传图片」选本地文件
 * 3. 在输入框里直接 Ctrl+V 粘贴剪贴板里的图片
 *
 * 上传走 /api/files?purpose=post（管理员），存成 /api/files/<id>，
 * 与 AI 生成的封面走同一套存储，发布后由 fileCacheScope 判定为公开可缓存。
 */
export function CoverField({
  value,
  onChange,
  onUploadingChange,
}: {
  value: string;
  onChange: (url: string) => void;
  onUploadingChange?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) {
      setError("请选择图片文件（PNG / JPEG / WebP）");
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      setError("图片不能超过 12 MB");
      return;
    }
    setBusy(true);
    onUploadingChange?.(true);
    setError("");
    try {
      const q = new URLSearchParams({
        purpose: "post",
        name: file.name || "cover.png",
      });
      const r = await fetch("/api/files?" + q, { method: "POST", body: file });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || "上传失败");
      const id = d.file?.id;
      if (!id) throw new Error("上传返回异常，请重试");
      onChange("/api/files/" + id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "上传失败，请重试");
    } finally {
      setBusy(false);
      onUploadingChange?.(false);
    }
  }

  return (
    <div className="cover-field form-row">
      <label>封面图（粘贴地址、上传图片，或直接 Ctrl+V 粘贴）</label>
      <div className="cover-input-row">
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://… 或 /api/files/…"
          onPaste={(e) => {
            const item = [...(e.clipboardData?.items || [])].find((i) =>
              i.type.startsWith("image/"),
            );
            const file = item?.getAsFile();
            if (file) {
              e.preventDefault();
              void upload(file);
            }
          }}
        />
        <button
          type="button"
          className="btn btn-ghost"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? "上传中…" : "上传图片"}
        </button>
        {value && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => onChange("")}
          >
            清除
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.currentTarget.value = "";
        }}
      />
      {error && (
        <p role="alert" className="save-error">
          {error}
        </p>
      )}
      {value ? (
        <img className="cover-preview" src={value} alt="封面预览" />
      ) : (
        <p className="hint">
          未设置封面。留空保存时，系统会自动用文章内容生成一张。
        </p>
      )}
    </div>
  );
}
