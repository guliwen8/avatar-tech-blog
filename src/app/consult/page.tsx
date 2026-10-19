import { currentMember } from "@/server/member-session";
import { ConsultationDesk } from "@/components/ConsultationDesk";
import { getSettings } from "@/server/repo";
import { ConsultDraft } from "@/components/ConsultDraft";
import { Icon } from "@/components/Icon";
export const dynamic = "force-dynamic";
export const metadata = { title: "人工咨询 · 阿凡达博客" };
export default async function ConsultPage() {
  const member = await currentMember();
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
      {member ? (
        <ConsultationDesk />
      ) : (
        <>
          <div className="reader-card">
            <h2>登录后提交咨询</h2>
            <p>提交的问题会保存到本站，可随时查看站长回复。</p>
            <a className="primary-button" href="/login?redirect=%2Fconsult">
              登录 / 注册
            </a>
          </div>
          <ConsultDraft email={email} url={url} />
        </>
      )}
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
        {!member && !email && !url && (
          <p className="consult-notice">
            登录后可以提交并查看咨询；未登录时的问题草稿只保存在当前浏览器。
          </p>
        )}
        <a href="/" className="text-link">
          先浏览技术文章 <Icon name="arrow" size={16} />
        </a>
      </section>
    </div>
  );
}
