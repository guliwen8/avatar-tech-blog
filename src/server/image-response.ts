/** Only provider status codes are exposed; never echo raw errors, prompts or keys. */
export function imageResultUrl(raw: unknown): string {
  const data = raw as {
    base_resp?: { status_code?: unknown };
    data?: { image_urls?: unknown };
  } | null;
  const value = data?.base_resp?.status_code;
  const code =
    (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) ||
    (typeof value === "string" && /^\d{1,8}$/.test(value))
      ? Number(value)
      : undefined;
  if (code === undefined)
    throw Error("MiniMax 图片响应未提供状态码，返回格式不兼容；未自动重试");
  if (code !== 0) {
    const hints: Record<number, string> = {
      1000: "服务暂时异常，请稍后手动重试",
      1001: "服务生成超时，请稍后检查",
      1002: "服务限流，请稍后手动重试",
      1004: "密钥验证或此接口授权失败，请核对密钥类型与账户区域",
      1008: "此请求的计费额度不足，请核对密钥对应的计费方式与账户额度",
      1024: "服务内部异常，请稍后手动重试",
      1026: "输入内容未通过审核，请修改图片描述",
      1027: "输出内容未通过审核，请修改图片描述",
      1039: "服务用量达到限制，请查看订阅用量",
      2013: "请求参数不受支持，请核对模型和图片参数",
      2049: "密钥无效，请在后台重新配置",
      2056: "订阅额度达到限制，请查看额度窗口和重置时间",
    };
    throw Error(
      `MiniMax 图片生成失败（错误码 ${code}）：${hints[code] || "服务未接受本次请求，请向 MiniMax 支持提供此错误码"}；未自动重试`,
    );
  }
  const urls = data?.data?.image_urls;
  if (
    !Array.isArray(urls) ||
    urls.length !== 1 ||
    typeof urls[0] !== "string" ||
    !urls[0].trim()
  )
    throw Error(
      "MiniMax 返回成功（错误码 0），但未提供一张有效图片 URL，返回格式不兼容；请勿连续重试",
    );
  return urls[0];
}
