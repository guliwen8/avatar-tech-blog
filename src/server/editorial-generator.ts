import {
  normalizeEditorial,
  buildEditorialPrompt,
  parseEditorialReply,
  editorialChecks,
} from "@/lib/editorial";
import { requestEditorialAI, type AIConfig } from "./editorial-ai";
export async function generateEditorial(
  config: AIConfig,
  value: unknown,
  signal?: AbortSignal,
) {
  const input = normalizeEditorial(value);
  if (!input.source.trim()) throw Error("请先输入原始素材");
  if (!config.enabled || !config.apiKey || !config.model)
    throw Error("AI 服务尚未配置或启用");
  const text = await requestEditorialAI(
    config,
    [
      {
        role: "system",
        content: buildEditorialPrompt(input.template, {
          source: input.source,
          style: input.style,
        }),
      },
      {
        role: "user",
        content: JSON.stringify({
          source: input.source,
          sources: input.sources,
        }),
      },
    ],
    signal,
  );
  const candidate = parseEditorialReply(text);
  return {
    ...candidate,
    warnings: [
      ...candidate.warnings,
      ...editorialChecks(
        input.source + "\n" + input.sources,
        candidate.content,
      ),
    ],
  };
}
