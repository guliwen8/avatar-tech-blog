import { getAllPostsMeta } from "@/lib/posts";
import { PostList } from "@/components/PostList";

// 首页：零度博客风格的网格 + 右侧栏
export default function HomePage() {
  const posts = getAllPostsMeta();
  return <PostList posts={posts} />;
}
