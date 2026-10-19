import { notFound } from "next/navigation";
import { getAllPostsMeta } from "@/lib/posts";
import { PostList } from "@/components/PostList";
export const dynamic = "force-dynamic";
export default async function TagPage({ params }: { params: Promise<{ name: string }> }) {
  const { name: rawName } = await params;
  let name: string;
  try { name = decodeURIComponent(rawName); } catch { notFound(); }
  const allPosts = getAllPostsMeta();
  const posts = allPosts.filter(post => post.tags.includes(name));
  if (!posts.length) notFound();
  return <><div className="breadcrumb"><a href="/">首页</a><span>/</span><a href="/tags">全部标签</a><span>/</span>{name}</div>
    <PostList posts={posts} allPosts={allPosts} title={`标签：${name}`} description="同一主题下的文章、视频与资源。" /></>;
}
