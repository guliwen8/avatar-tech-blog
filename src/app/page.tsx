import { getAllPostsMeta } from "@/lib/posts";
import { PostList } from "@/components/PostList";

// 首页：展示所有文章 + 搜索框
export default function HomePage() {
  const posts = getAllPostsMeta();

  return (
    <div className="container">
      <section className="hero">
        <h1>👋 欢迎来到阿凡达的技术博客</h1>
        <p>记录技术折腾、教程笔记和踩坑经验</p>
      </section>
      <PostList posts={posts} />
    </div>
  );
}
