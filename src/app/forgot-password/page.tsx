import { getSettings } from "@/server/repo";
export const dynamic = "force-dynamic";
export const metadata = { title: "找回密码 · 阿凡达博客" };
export default function Page() {
  const email = getSettings().contactEmail;
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || "");
  return (
    <section className="reader-auth">
      <h1>找回密码</h1>
      <p>当前通过站长人工核验找回账号，尚未提供邮件重置。</p>
      {valid ? (
        <a
          href={`mailto:${email}?subject=${encodeURIComponent("读者账号找回")}`}
        >
          联系站长核验账号
        </a>
      ) : (
        <p>站点尚未公布账号找回邮箱，请通过你已有的站长联系方式申请核验。</p>
      )}
      <p>请勿发送旧密码。站长完成核验并重置后，旧会话会失效。</p>
      <a href="/login">返回登录</a>
    </section>
  );
}
