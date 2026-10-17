import { getAllCategories, getAllPostsMeta } from "@/lib/posts";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "文章分类 · 阿凡达的技术博客",
};

export default function CategoriesPage() {
  const categories = getAllCategories();
  const posts = getAllPostsMeta();

  return (
    <div className="article-wrap">
      <div className="article">
        <div className="page-head">
          <h1>📂 文章分类</h1>
          <p>共 {categories.length} 个分类</p>
        </div>

        {categories.map((cat) => (
          <section key={cat.name} style={{ marginTop: 28 }}>
            <h2
              style={{
                fontSize: 20,
                fontWeight: 600,
                marginBottom: 12,
                color: "var(--text)",
              }}
            >
              {cat.name}（{cat.count}）
            </h2>
            {posts
              .filter((p) => p.category === cat.name)
              .map((post) => (
                <a
                  key={post.slug}
                  href={`/posts/${encodeURIComponent(post.slug)}`}
                  className="recent-item"
                >
                  <span className="t" style={{ fontSize: 15 }}>
                    {post.title}
                  </span>
                  <span className="d">📅 {post.date}</span>
                </a>
              ))}
          </section>
        ))}
      </div>
    </div>
  );
}
