import { getAllPostsMeta, searchPublishedPosts } from "@/lib/posts";
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
  const query = typeof params.q === "string" ? params.q.slice(0, 200) : "";
  return (
    <PostList
      key={query}
      posts={await searchPublishedPosts(query)}
      allPosts={getAllPostsMeta()}
      serverSearch
      ads={listAds(true)}
      title="搜索结果"
      description={
        query ? `搜索“${query}”` : "搜索标题、标签和当前账号有权阅读的正文。"
      }
      initialQuery={query}
    />
  );
}
