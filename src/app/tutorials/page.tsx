import { ChannelPage } from "@/components/ChannelPage";
export const dynamic = "force-dynamic";
export const metadata = { title: "教程 · 阿凡达博客" };
export default function Page() {
  return <ChannelPage channel="tutorials" />;
}
