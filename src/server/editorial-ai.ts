import type Database from "better-sqlite3";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import https from "node:https";
export interface AIConfig {
  allowVideoTranscription?: boolean;
  baseUrl: string;
  model: string;
  apiKey: string;
  enabled: boolean;
}
function ensure(db: Database.Database) {
  db.exec(
    "CREATE TABLE IF NOT EXISTS editorial_ai_config(id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL)",
  );
}
export function getAIConfig(db: Database.Database): AIConfig {
  ensure(db);
  const row = db
    .prepare("SELECT value FROM editorial_ai_config WHERE id=1")
    .get() as { value: string } | undefined;
  return row
    ? JSON.parse(row.value)
    : {
        baseUrl: "https://api.openai.com/v1",
        model: "",
        apiKey: "",
        enabled: false,
      };
}
export function publicAIConfig(c: AIConfig) {
  return {
    baseUrl: c.baseUrl,
    model: c.model,
    enabled: c.enabled,
    allowVideoTranscription: !!c.allowVideoTranscription,
    hasKey: !!c.apiKey,
    ready: !!(c.enabled && c.apiKey && c.model),
  };
}
export function providerUrl(raw: string) {
  const u = new URL(raw);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.search ||
    u.hash ||
    (u.port && u.port !== "443") ||
    isIP(u.hostname.replace(/^\[|\]$/g, "")) ||
    !u.hostname.includes(".") ||
    /\.(local|localhost|internal|test)$/i.test(u.hostname)
  )
    throw new Error(
      "API 地址须为公网 HTTPS 域名，不允许内网、IP、凭据或查询参数",
    );
  return u.href.replace(/\/$/, "");
}
export function saveAIConfig(db: Database.Database, input: unknown) {
  const r = input as Record<string, unknown>;
  if (!r || typeof r !== "object") throw new Error("配置格式不正确");
  const old = getAIConfig(db);
  const baseUrl = providerUrl(String(r.baseUrl || ""));
  const model = String(r.model || "").trim();
  if (!model || model.length > 120) throw new Error("请填写模型名称");
  let apiKey = old.apiKey;
  if (r.clearKey === true) apiKey = "";
  else if (typeof r.apiKey === "string" && r.apiKey) apiKey = r.apiKey;
  else if (baseUrl !== old.baseUrl && old.apiKey)
    throw new Error("更换 API 地址时请重新输入对应密钥");
  if (apiKey.length > 2000 || /[\s\r\n]/.test(apiKey))
    throw new Error("密钥格式不正确");
  const config = { baseUrl, model, apiKey, enabled: r.enabled === true, allowVideoTranscription:r.allowVideoTranscription === undefined ? !!old.allowVideoTranscription : r.allowVideoTranscription === true };
  if (config.enabled && !apiKey) throw new Error("启用前请填写 API Key");
  db.prepare(
    "INSERT OR REPLACE INTO editorial_ai_config(id,value) VALUES(1,?)",
  ).run(JSON.stringify(config));
  return publicAIConfig(config);
}
const blocked = new BlockList();
for (const [a, n] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["192.0.2.0", 24],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const)
  blocked.addSubnet(a, n, "ipv4");
for (const [a, n] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["2001::", 32],
] as const)
  blocked.addSubnet(a, n, "ipv6");
export function isPublicAddress(address: string, family: number) {
  return (
    !!isIP(address) &&
    (family !== 6 || /^[23]/i.test(address)) &&
    !blocked.check(address, family === 6 ? "ipv6" : "ipv4")
  );
}
// Resolve and pin a public address for this request; never follow redirects.
export async function requestEditorialAI(
  config: AIConfig,
  messages: { role: string; content: string }[],
  signal?: AbortSignal,
  deps = { lookup, request: https.request },
) {
  const endpoint = new URL(providerUrl(config.baseUrl) + "/chat/completions");
  const addresses = await deps.lookup(endpoint.hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some((a) => !isPublicAddress(a.address, a.family))
  )
    throw new Error("AI 服务域名解析到了非公网地址，已拒绝连接");
  if (signal?.aborted) throw new Error("请求已取消");
  // MiniMax reasoning and final JSON share the generation budget.
  const maxCompletionTokens = config.model.startsWith("MiniMax-") ? 16384 : 4096;
  const payload = JSON.stringify({
    model: config.model,
    messages,
    ...(config.model.startsWith("MiniMax-") ? { reasoning_split: true } : {}),
    max_completion_tokens: maxCompletionTokens,
    store: false,
  });
  return new Promise<string>((resolve, reject) => {
    const req = deps.request(
      endpoint,
      {
        method: "POST",
        headers: {
          Authorization: "Bearer " + config.apiKey,
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(payload),
        },
        lookup: (_host, options, callback) => {
          if (options.all) callback(null, addresses);
          else callback(null, addresses[0].address, addresses[0].family);
        },
      },
      (res) => {
        let bytes = 0;
        const chunks: Buffer[] = [];
        res.on("data", (chunk) => {
          bytes += chunk.length;
          if (bytes > 2 * 1024 * 1024) {
            req.destroy(new Error("AI 响应过大"));
            return;
          }
          chunks.push(chunk);
        });
        res.on("error", reject);
        res.on("end", () => {
          if (res.statusCode !== 200) {
            reject(
              new Error(
                `AI 服务返回 HTTP ${res.statusCode}，请检查地址、模型和密钥`,
              ),
            );
            return;
          }
          try {
            const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            if (data.choices?.[0]?.finish_reason === "length")
              throw new Error(
                `AI 输出达到 ${maxCompletionTokens} tokens 上限，候选稿未采用；原始素材保留。请分篇整理后手动重试，不会自动重试扣费`,
              );
            const text = data.choices?.[0]?.message?.content;
            if (typeof text !== "string") throw new Error("AI 返回格式不兼容");
            resolve(text);
          } catch (error) {
            reject(error);
          }
        });
      },
    );
    const timer = setTimeout(
      () => req.destroy(new Error("AI 请求超过 5 分钟，原稿保留；请检查服务状态后手动重试，不会自动重试扣费")),
      300000,
    );
    const cancel = () => req.destroy(new Error("请求已取消"));
    signal?.addEventListener("abort", cancel, { once: true });
    req.on("close", () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    });
    req.on("error", (error) =>
      reject(
        new Error(
          error.message.startsWith("AI ") || error.message === "请求已取消"
            ? error.message
            : "AI 服务连接失败，请检查配置后重试",
        ),
      ),
    );
    req.end(payload);
  });
}
