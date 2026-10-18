import { getSettings } from "@/server/repo";
import { getAllPostsMeta } from "@/lib/posts";
import { BlogSidebar } from "@/components/BlogSidebar";
import { Icon } from "@/components/Icon";
export const dynamic = "force-dynamic";
export const metadata = { title: "关于本站 · 阿凡达博客" };
export default function AboutPage() {
  const s = getSettings();
  return (
    <div className="content-layout">
      <article className="article about-article">
        <div className="breadcrumb">
          <a href="/">首页</a>
          <span>/</span>关于本站
        </div>
        <h1>关于{s.siteName || "阿凡达博客"}</h1>
        <p className="article-summary">
          {s.siteDesc || "分享技术教程、折腾笔记与踩坑经验。"}
        </p>
        <div className="prose">
          <h2>你好，我是阿凡达</h2>
          <p>
            这里记录学习和探索技术过程中的教程、笔记与实践经验。希望这些真实的操作过程，也能帮你解决手边的问题。
          </p>
          <h2>在这里，你可以找到</h2>
          <ul>
            <li>技术文章：从思路到步骤，记录实践过程。</li>
            <li>视频教程：通过分类和标签整理的实战内容。</li>
            <li>免费资源：开源项目、实用软件与工具。</li>
          </ul>
          <h2>一起交流</h2>
          <p>
            如果文章没有解答你的问题，可以先整理设备环境、错误信息与尝试过程，再通过咨询页面了解联系渠道。
          </p>
        </div>
        <a className="primary-button" href="/consult">
          联系与咨询 <Icon name="arrow" size={18} />
        </a>
      </article>
      <BlogSidebar posts={getAllPostsMeta()} />
    </div>
  );
}
