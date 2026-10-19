import { ReaderAuthForm } from "@/components/ReaderAuthForm";
import { safeReturnPath } from "@/lib/access";
import { currentMember } from "@/server/member-session";
import { redirect } from "next/navigation";
export const dynamic = "force-dynamic";
export const metadata = { title: "登录 · 阿凡达博客" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const target = safeReturnPath((await searchParams).redirect);
  if (await currentMember()) redirect(target);
  return <ReaderAuthForm mode="login" returnTo={target} />;
}
