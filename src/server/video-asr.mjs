import crypto from "node:crypto";
import { publicRequest } from "./video-http.mjs";
import { NeedsTranscript } from "./video-source.mjs";
export async function transcribeMiniMax(
  config,
  audio,
  signal,
  fetcher = publicRequest,
) {
  const base = new URL(config.baseUrl);
  if (
    !["api.minimax.cn", "api.minimaxi.com", "api.minimax.io"].includes(
      base.hostname,
    )
  )
    throw new NeedsTranscript(
      "当前转写仅支持 MiniMax 官方接口，请补充字幕或使用官方 MiniMax 配置",
    );
  const boundary = "avatar" + crypto.randomBytes(16).toString("hex");
  const fields = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nasr-1.0\r\n--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\njson\r\n--${boundary}\r\nContent-Disposition: form-data; name="stream"\r\n\r\nfalse\r\n--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.mp3"\r\nContent-Type: audio/mpeg\r\n\r\n`,
  );
  const body = Buffer.concat([
    fields,
    audio,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const response = await fetcher(new URL("/v1/speech_to_text", base).href, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + config.apiKey,
      "Content-Type": "multipart/form-data; boundary=" + boundary,
      "Content-Length": String(body.length),
    },
    body,
    signal,
    redirects: 0,
    maxBytes: 4 * 1024 * 1024,
    timeoutMs: 90000,
  });
  const data = JSON.parse(response.body.toString("utf8"));
  if (
    data.base_resp?.status_code ||
    typeof data.text !== "string" ||
    !data.text.trim()
  )
    throw new NeedsTranscript(
      "转写未返回有效文字，请检查转写权限、额度或补充字幕",
    );
  return data.text;
}
