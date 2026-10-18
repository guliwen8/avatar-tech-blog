import { listPlans } from "@/server/repo";
import { getAllPostsMeta } from "@/lib/posts";
import { selectChannel } from "@/lib/catalog";
import { MembershipPlans } from "@/components/MembershipPlans";
import { Icon } from "@/components/Icon";
import { PostCard } from "@/components/PostCard";
export const dynamic = "force-dynamic";
export const metadata = { title: "会员服务 · 阿凡达博客" };
export default function VipPage() {
  const posts = getAllPostsMeta();
  const videos = selectChannel(posts, "videos");
  const vip = posts.filter((p) => p.isVip);
  return (
    <div className="member-page">
      <nav className="member-content-nav" aria-label="会员内容导航">
        <a href="#plans">会员权益与套餐</a>
        <a href="/videos?type=member">浏览会员视频</a>
        <a href="/consult">人工咨询</a>
      </nav>
      <section className="member-hero">
        <p className="member-kicker">持续更新 · 一起探索</p>
        <h1>
          不止是内容
          <br />
          <span>更是专属的深度支持</span>
        </h1>
        <p className="member-lead">
          精选深度文章、实战教程与技术交流，
          <br className="desktop-break" />
          让每一次探索，都更进一步。
        </p>
        <div className="member-actions">
          <a href="/consult" className="primary-button">
            <Icon name="chat" size={18} />
            人工咨询
          </a>
          <a href="/" className="secondary-button">
            <Icon name="book" size={18} />
            浏览精选内容
          </a>
        </div>
        <div className="member-promises">
          <span>深度文章</span>
          <span>实战教程</span>
          <span>人工咨询</span>
          <span>持续更新</span>
        </div>
        <div className="member-stats">
          <div>
            <strong>{posts.length}</strong>
            <span>已发布文章</span>
          </div>
          <div>
            <strong>{videos.length}</strong>
            <span>视频内容</span>
          </div>
          <div>
            <strong>{vip.length}</strong>
            <span>VIP 标记内容</span>
          </div>
          <a href="/consult">
            <Icon name="chat" size={30} />
            <span>联系与咨询</span>
          </a>
        </div>
      </section>
      <section className="member-values">
        <div className="section-heading">
          <h2>从内容到实践</h2>
          <p>找到有用的知识，也找到下一步的方向。</p>
        </div>
        <div className="value-grid">
          {[
            {
              icon: "book" as const,
              title: "深度文章",
              text: "记录实际操作、技术思路和踩坑经验，让知识可以随时回看。",
              href: "/",
              link: "浏览文章",
            },
            {
              icon: "play" as const,
              title: "实战教程视频",
              text: "跟随教程探索工具和方法，把学到的知识用在实际场景里。",
              href: "/videos",
              link: "观看视频",
            },
            {
              icon: "chat" as const,
              title: "人工咨询",
              text: "整理你遇到的问题、运行环境与尝试过程，再与阿凡达沟通。",
              href: "/consult",
              link: "准备咨询",
            },
          ].map((v) => (
            <article key={v.title}>
              <Icon name={v.icon} size={30} />
              <h3>{v.title}</h3>
              <p>{v.text}</p>
              <a href={v.href}>
                {v.link}
                <Icon name="arrow" size={16} />
              </a>
            </article>
          ))}
        </div>
      </section>
      <MembershipPlans plans={listPlans(true)} />
      <section className="member-latest">
        <div className="section-heading section-heading-row">
          <div>
            <h2>最新精选</h2>
            <p>来自阿凡达博客的最新内容</p>
          </div>
          <a href="/">
            查看更多 <Icon name="arrow" size={16} />
          </a>
        </div>
        <div className="post-grid">
          {posts.slice(0, 3).map((p) => (
            <PostCard key={p.slug} post={p} />
          ))}
        </div>
      </section>
      <section className="member-bottom">
        <h2>下一次探索，从这里开始</h2>
        <p>先看看内容，再选择适合自己的学习方式。</p>
        <a href="/resources" className="primary-button">
          浏览免费资源 <Icon name="arrow" size={18} />
        </a>
      </section>
    </div>
  );
}
