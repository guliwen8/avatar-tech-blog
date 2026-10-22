"use client";
import { useEffect, useState } from "react";
export function ImageServiceConfig({ ready }: { ready: boolean }) {
  const [config, setConfig] = useState({
    baseUrl: "https://api.minimax.cn/v1",
    enabled: false,
    useTextKey: false,
    hasKey: false,
  });
  const [apiKey, setApiKey] = useState(""),
    [clearKey, setClearKey] = useState(false),
    [busy, setBusy] = useState(false),
    [loaded, setLoaded] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!ready) return;
    let active = true;
    fetch("/api/admin/image-config")
      .then(async (r) => {
        if (!r.ok) throw Error("无法加载图片配置");
        const d = await r.json();
        if (active) {
          setConfig(d);
          setLoaded(true);
        }
      })
      .catch((e) => {
        if (active) setMessage(e.message);
      });
    return () => {
      active = false;
    };
  }, [ready]);
  async function save() {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch("/api/admin/image-config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...config, apiKey, clearKey }),
      });
      const d = await r.json();
      if (!r.ok) throw Error(d.error || "保存失败");
      setConfig(d);
      setApiKey("");
      setClearKey(false);
      setMessage("图片配置已保存，尚未调用模型。请回到文章编辑器生成图片。");
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel image-service-config">
      <h2>文章图片配置 · MiniMax image-01</h2>
      <p>
        生成文章封面与正文概念插图。图片服务独立启用，每次点击生成一张；会员是否覆盖
        API 调用，以账户权限为准。
      </p>
      <fieldset disabled={!loaded || busy}>
        <div className="form-row">
          <label htmlFor="image-base">图片 API Base URL</label>
          <select
            id="image-base"
            value={config.baseUrl}
            onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
          >
            <option value="https://api.minimax.cn/v1">
              国内 · api.minimax.cn/v1
            </option>
            <option value="https://api.minimaxi.com/v1">
              国内 · api.minimaxi.com/v1
            </option>
            <option value="https://api.minimax.io/v1">
              国际 · api.minimax.io/v1
            </option>
          </select>
        </div>
        <label className="editorial-review">
          <input
            type="checkbox"
            checked={config.useTextKey}
            onChange={(e) =>
              setConfig({ ...config, useTextKey: e.target.checked })
            }
          />
          共用已保存的 MiniMax 文字服务密钥（API 地址须一致）
        </label>
        {!config.useTextKey && (
          <>
            <div className="form-row">
              <label htmlFor="image-key">图片 API Key</label>
              <input
                id="image-key"
                type="password"
                autoComplete="new-password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={
                  config.hasKey
                    ? "已配置，留空保持不变"
                    : "填写 MiniMax API Key"
                }
              />
            </div>
            <label className="editorial-review">
              <input
                type="checkbox"
                checked={clearKey}
                onChange={(e) => setClearKey(e.target.checked)}
              />
              删除独立图片密钥（请同时关闭启用）
            </label>
          </>
        )}
        <label className="editorial-review">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) =>
              setConfig({ ...config, enabled: e.target.checked })
            }
          />
          启用文章图片生成
        </label>
        <p className="hint">
          模型：image-01；比例：16:9。保存不生成图片，不改变文字服务设置。密钥仅保存在服务端。
        </p>
        <button type="button" className="btn btn-primary" onClick={save}>
          {busy ? "保存中…" : "保存图片配置"}
        </button>
      </fieldset>
      <p role="status">{message}</p>
    </section>
  );
}
