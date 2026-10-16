import { getAllCategories, getAllPostsMeta } from "@/lib/posts";

// 分类页：按分类分组展示所有文章
export const metadata = {
  title: "文章分类 · 阿凡达的技术博客",
};

export default function CategoriesPage() {
  const categories = getAllCategories();
  const posts = getAllPostsMeta();

  return (
    <div className="container">
      <section className="hero">
        <h1>📂 文章分类</h1>
        <p>共 {categories.length} 个分类</p>
        <div className="cat-row">
          {categories.map((c) => (
            <span key={c.name} className="cat-chip">
              {c.name} ({c.count})
            </span>
          ))}
        </div>
      </section>

      {categories.map((cat) => (
        <section key={cat.name} style={{ marginTop: 32 }}>
          <h2 style={{ fontSize: 20, marginBottom: 12 }}>{cat.name}</h2>
          <div className="post-list" style={{ paddingTop: 0 }}>
            {posts
              .filter((p) => p.category === cat.name)
              .map((post) => (
                <a
                  key={post.slug}
                  href={`/posts/${post.slug}`}
                  className="post-card"
                >
                  <div className="meta">
                    <span>{post.date}</span>
                    <span>·</span>
                    <span>{post.readingTime}</span>
                  </div>
                  <h2 style={{ fontSize: 18 }}>{post.title}</h2>
                  <p>{post.description}</p>
                </a>
              ))}
          </div>
        </section>
      ))}
    </div>
  );
}
