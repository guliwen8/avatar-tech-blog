import type { ContentDetails } from "./content-details";
export type AccessPolicy = "public" | "login" | "member";
export function canRead(
  policy: AccessPolicy,
  reader: { memberUntil: number } | null,
  now = Date.now(),
): boolean {
  return (
    policy === "public" ||
    (!!reader && (policy === "login" || reader.memberUntil > now))
  );
}
export function redactDetails(
  details?: ContentDetails,
): ContentDetails | undefined {
  if (!details || !details.access || details.access === "public")
    return details;
  const {
    videoUrl,
    sourceUrl,
    downloadUrl,
    repoUrl,
    demoUrl,
    ...publicDetails
  } = details;
  return publicDetails;
}
export function safeReturnPath(raw: unknown): string {
  return typeof raw === "string" &&
    raw.startsWith("/") &&
    !raw.startsWith("//") &&
    !raw.includes("\\") &&
    !/[\r\n]/.test(raw) &&
    !/^\/(?:admin|login|register|forgot-password)(?:\/|\?|$)/.test(raw)
    ? raw
    : "/account";
}
