import { getAllPostsMeta } from "@/lib/posts";
import { PostList } from "@/components/PostList";

// 首页：网格卡片 + 右侧栏
export default function HomePage() {
  const posts = getAllPostsMeta();

  return (
    <div className="container">
      <PostList posts={posts} />
    </div>
  );
}
