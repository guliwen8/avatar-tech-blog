export const metadata = {
  title: "关于 · 阿凡达的技术博客",
};

export default function AboutPage() {
  return (
    <div className="article-wrap">
      <article className="article">
        <a href="/" className="back">
          ← 返回首页
        </a>
        <h1>关于本站</h1>
        <div className="prose" style={{ marginTop: 20 }}>
          <p>
            你好，我是阿凡达 👋 这里是我的技术博客，用来记录我在学习和折腾技术过程中的
            教程、笔记和踩坑经验。
          </p>
          <h2>这个博客用什么做的？</h2>
          <ul>
            <li>框架：Next.js（React）</li>
            <li>文章：Markdown 文件，写起来像记事本一样简单</li>
            <li>部署：Vercel + 自建群晖 NAS（Docker）</li>
          </ul>
          <h2>联系我</h2>
          <p>可以在这里留下你的邮箱、GitHub、社交账号等联系方式。</p>
        </div>
      </article>
    </div>
  );
}
