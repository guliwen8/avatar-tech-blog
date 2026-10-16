import { getAllPostsMeta } from "@/lib/posts";
import { listAds } from "@/server/repo";
import { PostList } from "@/components/PostList";

// 数据来自数据库，动态渲染
export const dynamic = "force-dynamic";

// 首页：零度博客风格的网格 + 右侧栏
export default function HomePage() {
  const posts = getAllPostsMeta();
  const ads = listAds(true).map((a) => ({
    id: a.id,
    title: a.title,
    image: a.image,
    link: a.link,
  }));
  return <PostList posts={posts} ads={ads} />;
}
