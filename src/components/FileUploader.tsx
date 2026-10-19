"use client";
import { useEffect, useRef, useState } from "react";
export interface UploadedFile {
  id: string;
  name: string;
  mime: string;
  size: number;
  status: "pending" | "ready";
  purpose: "post" | "ticket";
  postSlug: string | null;
  uploadedBy: "admin" | "member";
  createdAt: number;
  url: string;
}
export function FileUploader({
  purpose,
  ticketId,
  label,
  accept,
  maxMB,
  onUploaded,
  onBusyChange,
}: {
  purpose: "post" | "ticket";
  ticketId?: string;
  label: string;
  accept: string;
  maxMB: number;
  onUploaded: (file: UploadedFile) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false),
    [progress, setProgress] = useState(0),
    [error, setError] = useState(""),
    [message, setMessage] = useState("");
  const xhrRef = useRef<XMLHttpRequest | null>(null),
    mounted = useRef(true),
    callback = useRef(onUploaded),
    busyCallback = useRef(onBusyChange);
  callback.current = onUploaded;
  busyCallback.current = onBusyChange;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      xhrRef.current?.abort();
      busyCallback.current?.(false);
    };
  }, []);
  async function upload(file: File) {
    setError("");
    setMessage("");
    if (!file.size || file.size > maxMB * 1024 * 1024) {
      setError(`请选择不超过 ${maxMB} MB 的文件`);
      return;
    }
    setBusy(true);
    busyCallback.current?.(true);
    setProgress(0);
    try {
      const result = await new Promise<UploadedFile>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhrRef.current = xhr;
        const query = new URLSearchParams({ purpose, name: file.name });
        if (ticketId) query.set("ticketId", ticketId);
        xhr.open("POST", "/api/files?" + query.toString());
        xhr.setRequestHeader("Content-Type", "application/octet-stream");
        xhr.upload.onprogress = (e) => {
          if (mounted.current && e.lengthComputable)
            setProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          try {
            const d = JSON.parse(xhr.responseText);
            if (xhr.status >= 200 && xhr.status < 300) resolve(d.file);
            else reject(new Error(d.error || "上传失败"));
          } catch {
            reject(new Error("上传失败，请稍后重试"));
          }
        };
        xhr.onerror = () => reject(new Error("上传连接中断，请重试"));
        xhr.onabort = () =>
          reject(new DOMException("上传已取消", "AbortError"));
        xhr.send(file);
      });
      if (mounted.current) {
        setMessage("已上传：" + result.name);
        callback.current(result);
      }
    } catch (e) {
      if (mounted.current) {
        if (e instanceof DOMException && e.name === "AbortError")
          setMessage("上传已取消");
        else setError(e instanceof Error ? e.message : "上传失败");
      }
    } finally {
      if (mounted.current) {
        setBusy(false);
        busyCallback.current?.(false);
      }
      xhrRef.current = null;
    }
  }
  return (
    <div className="file-uploader">
      <label>
        {label}
        <input
          type="file"
          accept={accept}
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
      </label>
      <p className="content-note">单个文件最大 {maxMB} MB。</p>
      {busy && (
        <div className="upload-progress">
          <progress max={100} value={progress} aria-label="上传进度" />
          <span>
            {progress}%{progress === 100 ? " · 正在校验" : ""}
          </span>
          <button
            type="button"
            className="secondary-button"
            onClick={() => xhrRef.current?.abort()}
          >
            取消上传
          </button>
        </div>
      )}
      {message && (
        <p role="status" className="content-note">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="save-error">
          {error}
        </p>
      )}
    </div>
  );
}
