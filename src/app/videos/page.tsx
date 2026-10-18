import { ChannelPage } from "@/components/ChannelPage";
export const dynamic = "force-dynamic";
export const metadata = { title: "视频 · 阿凡达博客" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const { type } = await searchParams;
  const filter = type === "free" || type === "member" ? type : "all";
  return <ChannelPage channel="videos" videoFilter={filter} />;
}
