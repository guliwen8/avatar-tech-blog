import { getAllPostsMeta } from "@/lib/posts";
import { listAds } from "@/server/repo";
import { PostList } from "@/components/PostList";
export const dynamic = "force-dynamic";
export const metadata = { title: "搜索 · 阿凡达博客" };
export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const params = await searchParams;
  const query = typeof params.q === "string" ? params.q : "";
  return (
    <PostList
      key={query}
      posts={getAllPostsMeta()}
      ads={listAds(true)}
      title="搜索结果"
      description={query ? `搜索“${query}”` : "输入关键词，查找感兴趣的内容。"}
      initialQuery={query}
    />
  );
}
