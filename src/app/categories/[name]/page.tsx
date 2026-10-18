import { notFound } from "next/navigation";
import { getAllPostsMeta } from "@/lib/posts";
import { PostList } from "@/components/PostList";
import { listAds } from "@/server/repo";
export const dynamic = "force-dynamic";
export default async function CategoryPage({
  params,
}: {
  params: Promise<{ name: string }>;
}) {
  const { name } = await params;
  const category = decodeURIComponent(name);
  const all = getAllPostsMeta();
  const posts = all.filter((p) => p.category === category);
  if (!posts.length) notFound();
  return (
    <PostList
      posts={posts}
      allPosts={all}
      ads={listAds(true)}
      title={category}
      description={`${category}分类下的全部内容`}
    />
  );
}
