"use client";
import { useEffect, useState } from "react";
import { ImageServiceConfig } from "@/components/ImageServiceConfig";
import { AdminShell, useAdminReady } from "../AdminShell";
function Config() {
  const ready = useAdminReady();
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1"),
    [model, setModel] = useState(""),
    [apiKey, setApiKey] = useState(""),
    [hasKey, setHasKey] = useState(false),
    [enabled, setEnabled] = useState(false),
    [allowVideoTranscription, setAllowVideoTranscription] = useState(false),
    [message, setMessage] = useState(""),
    [busy, setBusy] = useState(false),
    [clearKey, setClearKey] = useState(false);
  useEffect(() => {
    if (!ready) return;
    fetch("/api/admin/editorial-config")
      .then(async (r) => {
        if (!r.ok) throw Error("无法加载配置");
        const d = await r.json();
        setBaseUrl(d.baseUrl);
        setModel(d.model);
        setHasKey(d.hasKey);
        setEnabled(d.enabled);
        setAllowVideoTranscription(!!d.allowVideoTranscription);
      })
      .catch((e) => setMessage(e.message));
  }, [ready]);
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/admin/editorial-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          baseUrl,
          model,
          apiKey,
          enabled,
          clearKey,
          allowVideoTranscription,
        }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "保存失败");
      setHasKey(d.hasKey);
      setApiKey("");
      setClearKey(false);
      setMessage(
        "配置已保存。请回到文章编辑器生成候选稿；保存配置不会调用 AI。",
      );
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <div className="panel">
        <h2>AI 草稿服务配置</h2>
        <p>
          支持 OpenAI 兼容 Chat Completions
          接口。请填写你已有服务商提供的地址、模型和密钥。
        </p>
        <div className="form-row">
          <label htmlFor="ai-base">API Base URL（包含 /v1 等路径）</label>
          <input
            id="ai-base"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://api.example.com/v1"
          />
        </div>
        <div className="form-row">
          <label htmlFor="ai-model">模型名称</label>
          <input
            id="ai-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
          />
        </div>
        <div className="form-row">
          <label htmlFor="ai-key">API Key</label>
          <input
            id="ai-key"
            type="password"
            autoComplete="new-password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasKey ? "已保存密钥，留空保持不变" : "填写 API Key"}
          />
        </div>
        <label>
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          启用 AI 草稿服务
        </label>
        <label style={{ display: "block", marginTop: 12 }}>
          <input
            type="checkbox"
            checked={clearKey}
            onChange={(e) => setClearKey(e.target.checked)}
          />
          删除已保存密钥（同时关闭启用开关）
        </label>
        <label style={{ display: "block", marginTop: 12 }}>
          <input
            type="checkbox"
            checked={allowVideoTranscription}
            onChange={(e) => setAllowVideoTranscription(e.target.checked)}
          />
          允许视频语音转写（仅 MiniMax 官方接口，可能另行计费，默认关闭）
        </label>
        <p className="hint">
          密钥保存在服务端数据库专用表，不返回给前端或公开设置接口。数据库备份也包含该密钥，请妥善保管。只支持公网
          HTTPS 地址，不读取来源网页。
        </p>
        <div className="form-actions">
          <button className="btn btn-primary" disabled={busy} onClick={save}>
            {busy ? "保存中…" : "保存 AI 配置"}
          </button>
          <a href="/admin/posts/edit" className="btn btn-ghost">
            返回文章编辑器
          </a>
        </div>
        <p role="status">{message}</p>
      </div>
      <ImageServiceConfig ready={ready} />
    </>
  );
}
export default function Page() {
  return (
    <AdminShell title="AI 草稿配置" active="/admin/editorial">
      <Config />
    </AdminShell>
  );
}
