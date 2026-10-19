"use client";
import { useCallback, useEffect, useState, useRef } from "react";
import { TextMaterialIntake } from "@/components/TextMaterialIntake";
import { AdminShell, useAdminReady } from "../AdminShell";
import { EDITORIAL_TEMPLATES } from "@/lib/editorial";
interface Job {
  id: string;
  url: string;
  status: string;
  error: string;
  post_slug: string;
  created_at: number;
  attempts: number;
}
const labels: Record<string, string> = {
  queued: "排队中",
  running: "采集与整理中",
  succeeded: "候选稿待审核",
  needs_input: "需要补充材料",
  failed: "未完成",
  cancelled: "已取消",
};
function Imports() {
  const [mode, setMode] = useState("link"),
    [video, setVideo] = useState<File | null>(null),
    [uploaded, setUploaded] = useState<{ url: string; name: string } | null>(
      null,
    );
  const uploadAbort = useRef<AbortController | null>(null);
  useEffect(() => () => uploadAbort.current?.abort(), []);
  const ready = useAdminReady();
  const [url, setUrl] = useState(""),
    [template, setTemplate] = useState("tutorial"),
    [style, setStyle] = useState("auto"),
    [transcript, setTranscript] = useState(""),
    [jobs, setJobs] = useState<Job[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [blocked, setBlocked] = useState(false),
    [notes, setNotes] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    const r = await fetch("/api/admin/video-imports", { cache: "no-store" });
    if (r.status === 401) {
      setBlocked(true);
      throw Error("登录已过期，请刷新后重新登录");
    }
    if (!r.ok) throw Error("无法读取任务状态");
    setJobs(await r.json());
  }, []);
  useEffect(() => {
    if (ready) load().catch((e) => setMessage(e.message));
  }, [ready, load]);
  const pending = jobs.some((j) => ["queued", "running"].includes(j.status));
  useEffect(() => {
    if (!ready || !pending || blocked) return;
    const timer = setInterval(() => {
      if (document.visibilityState === "visible")
        load().catch((e) => setMessage(e.message));
    }, 3000);
    return () => clearInterval(timer);
  }, [ready, pending, blocked, load]);
  async function action(body: any) {
    setBusy(true);
    setMessage("");
    try {
      if (body.action === "create" && mode === "file") {
        let source = uploaded;
        if (!source) {
          if (!video) throw Error("请选择本地视频");
          uploadAbort.current = new AbortController();
          setMessage("正在上传视频，请稍候…");
          const response = await fetch(
            "/api/admin/video-upload?name=" + encodeURIComponent(video.name),
            {
              method: "POST",
              headers: { "Content-Type": "application/octet-stream" },
              body: video,
              signal: uploadAbort.current.signal,
            },
          );
          const result = await response.json();
          if (!response.ok) throw Error(result.error || "视频上传失败");
          source = result;
          setUploaded(result);
        }
        body = { ...body, url: source!.url };
      }
      const r = await fetch("/api/admin/video-imports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "操作失败");
      setMessage("操作已提交，结果保存在任务列表中，不会自动发布。");
      await load();
    } catch (e) {
      setMessage(
        e instanceof Error && e.name === "AbortError"
          ? "上传已取消"
          : e instanceof Error
            ? e.message
            : "操作失败",
      );
    } finally {
      setBusy(false);
    }
  }
  async function upload(file?: File) {
    if (!file) return;
    if (file.size > 200000) {
      setMessage("字幕文件过大，请选择一段不超过 40000 字符的内容");
      return;
    }
    const text = await file.text();
    if (text.length > 40000) {
      setMessage("字幕最多 40000 字符，请分段整理");
      return;
    }
    setTranscript(text);
  }
  return (
    <>
      <section className="panel video-import-form">
        <h2>视频素材 → 候选草稿</h2>
        <p>
          支持 YouTube、哔哩哔哩与 HTTPS MP4 直链，也支持本地 MP4、WebM
          文件。优先读取字幕；读取不到时可补字幕，或在 AI
          配置中单独启用语音转写。
        </p>
        <p className="hint">
          提交后可能调用已配置的 AI
          与转写服务并计费。总结仅依据字幕或语音，画面和屏幕操作需人工核验。音视频转写最多
          10 分钟；自动读取平台字幕不受此时长限制，字幕最多 40000
          字符，媒体文件最多 80 MB。
        </p>
        <div className="form-actions" role="group" aria-label="视频来源方式">
          <button
            className="btn btn-ghost"
            disabled={busy}
            aria-pressed={mode === "link"}
            onClick={() => setMode("link")}
          >
            粘贴视频链接
          </button>
          <button
            className="btn btn-ghost"
            disabled={busy}
            aria-pressed={mode === "file"}
            onClick={() => setMode("file")}
          >
            选择本地文件
          </button>
        </div>
        {mode === "link" ? (
          <div className="form-row">
            <label htmlFor="video-source-url">视频链接</label>
            <input
              id="video-source-url"
              type="url"
              value={url}
              maxLength={4096}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=… 或 B站视频 / MP4 链接"
            />
          </div>
        ) : (
          <div className="form-row">
            <label htmlFor="local-video-file">
              本地视频文件（MP4 / WebM，最多 80 MB）
            </label>
            <input
              id="local-video-file"
              type="file"
              accept=".mp4,.webm,video/mp4,video/webm"
              disabled={busy || !!uploaded}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                if (
                  f.size > 80 * 1024 * 1024 ||
                  f.size === 0 ||
                  !/\.(mp4|webm)$/i.test(f.name)
                ) {
                  setMessage("请选择不超过 80 MB 的 MP4 或 WebM 视频");
                  setVideo(null);
                  e.target.value = "";
                  return;
                }
                setVideo(f);
                setMessage("");
              }}
            />
            {(uploaded || video) && (
              <p>
                {uploaded?.name || video?.name}{" "}
                {video ? `（${(video.size / 1024 / 1024).toFixed(1)} MB）` : ""}
              </p>
            )}
            <p className="hint">
              提交时上传至后台私有素材区，不会自动公开；没有补充字幕时需启用语音转写。源文件保存
              7 天，处理中保留；临时音频处理后清理。
            </p>
            {uploaded && (
              <button
                className="btn btn-ghost"
                disabled={busy}
                onClick={async () => {
                  try {
                    const r = await fetch(
                      "/api/admin/video-upload?url=" +
                        encodeURIComponent(uploaded.url),
                      { method: "DELETE" },
                    );
                    const d = await r.json();
                    if (!r.ok) throw Error(d.error);
                    setUploaded(null);
                    setVideo(null);
                    setMessage("本地源文件已删除");
                  } catch (e) {
                    setMessage(e instanceof Error ? e.message : "删除失败");
                  }
                }}
              >
                删除已上传源文件
              </button>
            )}
          </div>
        )}
        <div className="editorial-controls">
          <label htmlFor="import-template">文章模板</label>
          <select
            id="import-template"
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
          >
            {Object.entries(EDITORIAL_TEMPLATES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <label htmlFor="import-style">整理方式</label>
          <select
            id="import-style"
            value={style}
            onChange={(e) => setStyle(e.target.value)}
          >
            <option value="auto">自动</option>
            <option value="concise">简洁整理</option>
            <option value="complete">完整教程</option>
          </select>
        </div>
        <p className="hint">
          填写视频地址后，提交即可自动获取可用字幕，无需上传字幕文件。没有字幕时，才尝试已启用的语音转写。
        </p>
        <details className="import-caption-fallback">
          <summary>自动获取失败时，手动补充字幕（可选）</summary>
          <div className="form-row">
            <label htmlFor="import-transcript">
              补充字幕（选填，填写后直接使用，不再读取视频）
            </label>
            <textarea
              id="import-transcript"
              maxLength={40000}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              placeholder="可粘贴字幕文字、SRT、VTT 或字幕 JSON。平台无法读取时也可以在任务列表补充。"
            />
            <label htmlFor="import-caption-file">
              导入字幕文件（本地读取）
            </label>
            <input
              id="import-caption-file"
              type="file"
              accept=".srt,.vtt,.txt,.json"
              onChange={(e) => upload(e.target.files?.[0])}
            />
          </div>
        </details>
        <div className="form-actions">
          <button
            className="btn btn-primary"
            disabled={
              busy ||
              (mode === "link" ? !url.trim() : !video && !uploaded) ||
              blocked
            }
            onClick={() =>
              action({ action: "create", url, template, style, transcript })
            }
          >
            {busy ? "上传或提交中…" : "采集并生成候选稿"}
          </button>
          <a className="btn btn-ghost" href="/admin/editorial">
            AI 与转写配置
          </a>
        </div>
        {busy && mode === "file" && (
          <button
            className="btn btn-ghost"
            onClick={() => uploadAbort.current?.abort()}
          >
            取消上传
          </button>
        )}
        <p role="status">{message}</p>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h3>采集任务</h3>
          <button
            className="btn btn-ghost"
            onClick={() => load().catch((e) => setMessage(e.message))}
          >
            刷新状态
          </button>
        </div>
        <p className="hint">
          成功后打开候选稿，核对并采用，再主动确认发布。网络受限、需登录或不可读取的来源会显示原因；不会凭视频标题编造内容。
        </p>
        {!jobs.length && <p>还没有采集任务。</p>}
        <div className="import-job-list">
          {jobs.map((j) => (
            <article className="import-job" key={j.id}>
              <div className="import-job-head">
                <strong>{labels[j.status] || j.status}</strong>
                <time>{new Date(j.created_at).toLocaleString()}</time>
              </div>
              <p className="import-source-url">
                {j.url.startsWith("local-video:") ? "本地上传视频" : j.url}
              </p>
              {j.error && <p className="import-job-error">{j.error}</p>}
              {j.url.startsWith("local-video:") &&
                !["queued", "running"].includes(j.status) && (
                  <button
                    className="btn btn-ghost"
                    disabled={busy}
                    onClick={async () => {
                      if (
                        !window.confirm(
                          "删除本地源视频？已生成候选稿会保留，之后重试需重新上传。",
                        )
                      )
                        return;
                      try {
                        const r = await fetch(
                          "/api/admin/video-upload?url=" +
                            encodeURIComponent(j.url),
                          { method: "DELETE" },
                        );
                        const d = await r.json();
                        if (!r.ok) throw Error(d.error);
                        if (uploaded?.url === j.url) {
                          setUploaded(null);
                          setVideo(null);
                        }
                        setMessage("源视频已删除，候选稿保持不变");
                      } catch (e) {
                        setMessage(e instanceof Error ? e.message : "删除失败");
                      }
                    }}
                  >
                    删除本地源视频
                  </button>
                )}
              {j.status === "succeeded" ? (
                <a
                  className="btn btn-primary"
                  href={
                    "/admin/posts/edit?slug=" + encodeURIComponent(j.post_slug)
                  }
                >
                  查看并审核候选稿
                </a>
              ) : ["queued", "running"].includes(j.status) ? (
                <button
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => action({ action: "cancel", id: j.id })}
                >
                  取消任务
                </button>
              ) : (
                <>
                  <label htmlFor={"retry-" + j.id}>
                    补充字幕后重试（可留空使用原材料或新配置）
                  </label>
                  <textarea
                    id={"retry-" + j.id}
                    maxLength={40000}
                    value={notes[j.id] || ""}
                    onChange={(e) =>
                      setNotes({ ...notes, [j.id]: e.target.value })
                    }
                  />
                  <button
                    className="btn btn-ghost"
                    disabled={busy || j.attempts >= 3}
                    onClick={() =>
                      action({
                        action: "retry",
                        id: j.id,
                        ...(notes[j.id]?.trim()
                          ? { transcript: notes[j.id] }
                          : {}),
                      })
                    }
                  >
                    重试采集
                  </button>
                </>
              )}
            </article>
          ))}
        </div>
      </section>
    </>
  );
}
function Intake() {
  const [view, setView] = useState("text"),
    [videoOpened, setVideoOpened] = useState(false);
  return (
    <>
      <div className="panel">
        <div className="form-actions" role="group" aria-label="素材类型">
          <button
            className="btn btn-ghost"
            aria-pressed={view === "text"}
            onClick={() => setView("text")}
          >
            文字与文档素材
          </button>
          <button
            className="btn btn-ghost"
            aria-pressed={view === "video"}
            onClick={() => {
              setVideoOpened(true);
              setView("video");
            }}
          >
            视频素材（可选）
          </button>
        </div>
      </div>
      <div hidden={view !== "text"}>
        <TextMaterialIntake />
      </div>
      {videoOpened && (
        <div hidden={view !== "video"}>
          <Imports />
        </div>
      )}
    </>
  );
}
export default function Page() {
  return (
    <AdminShell title="素材采集与整理" active="/admin/imports">
      <Intake />
    </AdminShell>
  );
}
