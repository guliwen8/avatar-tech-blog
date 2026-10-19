import { currentMember } from "@/server/member-session";
import { redirect } from "next/navigation";
import { ReaderAccount } from "@/components/ReaderAccount";
export const dynamic = "force-dynamic";
export const metadata = { title: "我的账号 · 阿凡达博客" };
export default async function Page() {
  const member = await currentMember();
  if (!member) redirect("/login?redirect=%2Faccount");
  return <ReaderAccount member={member} />;
}
