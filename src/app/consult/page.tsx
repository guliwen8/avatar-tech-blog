import { getSettings } from "@/server/repo";
import { ConsultDraft } from "@/components/ConsultDraft";
import { Icon } from "@/components/Icon";
export const dynamic = "force-dynamic";
export const metadata = { title: "人工咨询 · 阿凡达博客" };
export default function ConsultPage() {
  const settings = getSettings();
  const email = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(settings.contactEmail || "")
    ? settings.contactEmail
    : undefined;
  let url: string | undefined;
  try {
    const u = new URL(settings.consultationUrl);
    if (u.protocol === "https:") url = u.href;
  } catch {}
  return (
    <div className="consult-page">
      <div className="breadcrumb">
        <a href="/">首页</a>
        <span>/</span>人工咨询
      </div>
      <div className="consult-heading">
        <h1>人工咨询</h1>
        <a href="/vip">
          查看会员服务 <Icon name="arrow" size={16} />
        </a>
      </div>
      <ConsultDraft email={email} url={url} />
      <section className="consult-card consult-guide">
        <h2>
          <Icon name="book" />
          咨询前，准备这些信息
        </h2>
        <ol>
          <li>
            <strong>你想完成什么</strong>
            <span>说明目标，以及当前卡在哪一步。</span>
          </li>
          <li>
            <strong>运行环境</strong>
            <span>设备、操作系统、软件名称与版本。</span>
          </li>
          <li>
            <strong>错误与尝试过程</strong>
            <span>保留错误信息，并列出已经尝试的方法。</span>
          </li>
        </ol>
        {!email && !url && (
          <p className="consult-notice">
            在线咨询暂未开放。你可以先保存问题草稿，或浏览已有教程。
          </p>
        )}
        <a href="/" className="text-link">
          先浏览技术文章 <Icon name="arrow" size={16} />
        </a>
      </section>
    </div>
  );
}
