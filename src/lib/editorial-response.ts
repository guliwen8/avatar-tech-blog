/** Accept legacy JSON and streaming generation, but never accept a partial result. */
export async function readEditorialResponse(response: Response): Promise<any> {
  if (
    !response.ok ||
    !response.headers.get("Content-Type")?.includes("application/x-ndjson")
  ) {
    const data = await response.json();
    if (!response.ok) throw Error(data.error || "处理失败");
    return data;
  }
  if (!response.body) throw Error("生成连接中断，原稿保留，请检查后手动重试");
  const reader = response.body.getReader(),
    decoder = new TextDecoder();
  let buffer = "",
    bytes = 0,
    result: unknown,
    complete = false;
  function event(line: string) {
    if (!line.trim()) return;
    const data = JSON.parse(line);
    if (data.type === "error") throw Error(data.error || "生成失败");
    if (data.type === "result") {
      result = data.result;
      complete = true;
    }
  }
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > 1024 * 1024) throw Error("AI 响应过大，原稿保留");
      buffer += decoder.decode(part.value, { stream: true });
      let end;
      while ((end = buffer.indexOf("\n")) >= 0) {
        event(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
      }
    }
    buffer += decoder.decode();
    if (buffer.trim()) event(buffer);
    if (!complete) throw Error("生成连接中断，原稿保留，请检查后手动重试");
    return result;
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
