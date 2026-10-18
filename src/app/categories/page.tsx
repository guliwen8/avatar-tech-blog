import { getAllCategories, getAllPostsMeta } from "@/lib/posts";
import { BlogSidebar } from "@/components/BlogSidebar";
import { Icon } from "@/components/Icon";
export const dynamic = "force-dynamic";
export const metadata = { title: "全部分类 · 阿凡达博客" };
export default function CategoriesPage() {
  const cats = getAllCategories();
  return (
    <div className="content-layout">
      <section className="directory">
        <div className="breadcrumb">
          <a href="/">首页</a>
          <span>/</span>全部分类
        </div>
        <h1>全部分类</h1>
        <p className="page-intro">按主题浏览，找到你感兴趣的内容。</p>
        <div className="category-directory">
          {cats.map((c) => (
            <a href={`/categories/${encodeURIComponent(c.name)}`} key={c.name}>
              <Icon name="book" />
              <div>
                <h2>{c.name}</h2>
                <span>{c.count} 篇文章</span>
              </div>
              <Icon name="arrow" />
            </a>
          ))}
        </div>
      </section>
      <BlogSidebar posts={getAllPostsMeta()} />
    </div>
  );
}
