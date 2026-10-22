// @ts-ignore Native test runner.
import { imageResultUrl } from "./image-response.ts";
import type Database from "better-sqlite3";
// @ts-ignore Node's native test runner resolves explicit TypeScript extensions.
import { getAIConfig, providerUrl } from "./editorial-ai.ts";
// @ts-ignore Native test runner.
import { uploadPrivateFile } from "./private-files.ts";
// @ts-ignore Native test runner.
import { normalizeArticleImage } from "../lib/article-images.ts";
import type { ArticleImage } from "../lib/article-images";
import { publicRequest } from "./video-http.mjs";
export interface ImageConfig {
  baseUrl: string;
  apiKey: string;
  enabled: boolean;
  useTextKey: boolean;
}
function endpoint(raw: string) {
  const base = providerUrl(raw),
    u = new URL(base);
  if (
    !["api.minimax.cn", "api.minimaxi.com", "api.minimax.io"].includes(
      u.hostname,
    ) ||
    u.pathname !== "/v1"
  )
    throw Error("图片接口请使用 MiniMax 官方 API 地址（以 /v1 结尾）");
  return base;
}
export function getImageConfig(db: Database.Database): ImageConfig {
  db.exec(
    "CREATE TABLE IF NOT EXISTS editorial_image_config(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL)",
  );
  const row = db
    .prepare("SELECT value FROM editorial_image_config WHERE id=1")
    .get() as { value: string } | undefined;
  return row
    ? JSON.parse(row.value)
    : {
        baseUrl: "https://api.minimax.cn/v1",
        apiKey: "",
        enabled: false,
        useTextKey: false,
      };
}
export function resolveImageConfig(db: Database.Database): ImageConfig {
  const config = getImageConfig(db);
  if (config.useTextKey) {
    const text = getAIConfig(db);
    if (endpoint(text.baseUrl) !== endpoint(config.baseUrl))
      throw Error("共用文字密钥时，图片与文字 API 地址必须一致");
    return { ...config, apiKey: text.apiKey };
  }
  return config;
}
export function publicImageConfig(db: Database.Database) {
  const c = getImageConfig(db);
  let hasKey = !!c.apiKey;
  if (c.useTextKey) {
    const text = getAIConfig(db);
    hasKey = !!text.apiKey && text.baseUrl.replace(/\/$/, "") === c.baseUrl;
  }
  return {
    baseUrl: c.baseUrl,
    model: "image-01",
    enabled: c.enabled,
    useTextKey: c.useTextKey,
    hasKey,
    ready: c.enabled && hasKey,
  };
}
export function saveImageConfig(db: Database.Database, input: unknown) {
  const r = input as Record<string, unknown>;
  if (!r || typeof r !== "object") throw Error("配置格式不正确");
  const old = getImageConfig(db),
    baseUrl = endpoint(String(r.baseUrl || ""));
  let apiKey = old.apiKey;
  if (r.clearKey === true) apiKey = "";
  else if (typeof r.apiKey === "string" && r.apiKey) apiKey = r.apiKey;
  else if (baseUrl !== old.baseUrl && old.apiKey && !r.useTextKey)
    throw Error("更换图片 API 地址时请重新填写密钥");
  if (baseUrl !== old.baseUrl && r.useTextKey === true) apiKey = "";
  if (apiKey.length > 2000 || /\s/.test(apiKey)) throw Error("密钥格式不正确");
  const config = {
    baseUrl,
    apiKey,
    enabled: r.enabled === true,
    useTextKey: r.useTextKey === true,
  };
  if (config.useTextKey) {
    const text = getAIConfig(db);
    if (endpoint(text.baseUrl) !== baseUrl)
      throw Error("共用文字密钥时，图片与文字 API 地址必须一致");
    if (config.enabled && !text.apiKey)
      throw Error("请先配置文字密钥，或单独填写图片密钥");
  } else if (config.enabled && !apiKey) throw Error("启用图片生成前请填写密钥");
  db.prepare(
    "INSERT OR REPLACE INTO editorial_image_config(id,value) VALUES(1,?)",
  ).run(JSON.stringify(config));
  return publicImageConfig(db);
}
export async function generateArticleImage(
  db: Database.Database,
  root: string,
  config: ImageConfig,
  input: unknown,
  signal?: AbortSignal,
  deps = { request: publicRequest },
): Promise<ArticleImage> {
  if (signal?.aborted) throw Error("图片生成已取消");
  const base = endpoint(config.baseUrl),
    r = input as Record<string, unknown>;
  if (!config.enabled || !config.apiKey)
    throw Error("请先配置并启用图片生成服务");
  if (
    !r ||
    typeof r.prompt !== "string" ||
    !r.prompt.trim() ||
    r.prompt.length > 1500 ||
    !["cover", "body"].includes(String(r.role)) ||
    typeof r.caption !== "string" ||
    r.caption.length > 200 ||
    typeof r.section !== "string" ||
    r.section.length > 200
  )
    throw Error("图片描述或用途格式不正确");
  const result = await deps.request(base + "/image_generation", {
    method: "POST",
    redirects: 0,
    signal,
    maxBytes: 1024 * 1024,
    timeoutMs: 90000,
    headers: {
      Authorization: "Bearer " + config.apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "image-01",
      prompt: r.prompt,
      aspect_ratio: "16:9",
      response_format: "url",
      n: 1,
      prompt_optimizer: false,
    }),
  });
  let data;
  try {
    data = JSON.parse(result.body.toString("utf8"));
  } catch {
    throw Error("图像服务返回格式不正确");
  }
  const image = await deps.request(imageResultUrl(data), {
    signal,
    maxBytes: 12 * 1024 * 1024,
    timeoutMs: 30000,
    redirects: 0,
  });
  const bytes = image.body;
  const ext = bytes
    .subarray(0, 8)
    .equals(Buffer.from("89504e470d0a1a0a", "hex"))
    ? "png"
    : bytes.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex"))
      ? "jpg"
      : bytes.toString("ascii", 0, 4) === "RIFF" &&
          bytes.toString("ascii", 8, 12) === "WEBP"
        ? "webp"
        : null;
  if (!ext) throw Error("图像服务返回的文件不是受支持的图片");
  if (signal?.aborted) throw Error("图片生成已取消，未写入文章");
  const file = await uploadPrivateFile(db, root, {
    name: `AI-${r.role}.${ext}`,
    purpose: "post",
    actor: { admin: true },
    body: new ReadableStream({
      start(c) {
        c.enqueue(bytes);
        c.close();
      },
    }),
    contentLength: bytes.length,
    maxBytes: 12 * 1024 * 1024,
  });
  return normalizeArticleImage({
    id: file.id,
    url: "/api/files/" + file.id,
    role: r.role,
    caption: r.caption,
    section: r.section,
    prompt: r.prompt,
  });
}
