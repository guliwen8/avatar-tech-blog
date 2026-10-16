"use client";

import { useEffect, useState } from "react";

interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  features: string[];
  highlight: boolean;
}

// 默认套餐（与后台一致）；若后台改过则读取后台数据
const DEFAULT_PLANS: Plan[] = [
  {
    id: "plan-month",
    name: "月度会员",
    price: 29,
    period: "/月",
    features: ["全部付费文章", "实战视频教程", "会员专属下载"],
    highlight: false,
  },
  {
    id: "plan-year",
    name: "年度会员",
    price: 199,
    period: "/年",
    features: ["月度全部权益", "一对一人工咨询", "优先答疑", "全年持续更新"],
    highlight: true,
  },
  {
    id: "plan-forever",
    name: "永久会员",
    price: 599,
    period: "永久",
    features: ["年度全部权益", "终身免费更新", "远程协助服务", "专属社群"],
    highlight: false,
  },
];

export default function VipPage() {
  const [plans, setPlans] = useState<Plan[]>(DEFAULT_PLANS);

  useEffect(() => {
    // 若后台在本机改过套餐，优先用后台数据
    try {
      const raw = localStorage.getItem("avatar_admin_plans");
      if (raw) {
        const data = JSON.parse(raw) as (Plan & { enabled: boolean })[];
        setPlans(data.filter((p) => p.enabled));
      }
    } catch {}
  }, []);

  function buy(name: string) {
    alert(
      `你选择了「${name}」。\n\n支付功能将在部署到群晖 NAS、接入支付接口（微信/支付宝）后开通。`
    );
  }

  return (
    <div className="vip-page">
      <section className="vip-hero">
        <div className="vip-eyebrow">持续更新 · 随时加入</div>
        <h1>
          不止是内容
          <br />
          <span className="gold">更是专属的深度支持</span>
        </h1>
        <p className="lead">
          汇聚精选深度文章、实战教程视频与一对一人工咨询，帮你构建长期成长壁垒。
        </p>
        <div className="vip-cta">
          <button className="vip-btn gold" onClick={() => buy("立即咨询")}>
            💬 立即咨询
          </button>
          <a className="vip-btn ghost" href="/">
            📖 浏览精选内容
          </a>
        </div>
        <div className="vip-points">
          <span>🛡️ 安全支付</span>
          <span>⚡ 即时开通</span>
          <span>🎖️ 专属服务</span>
          <span>🔄 持续更新</span>
        </div>
      </section>

      <section className="vip-stats">
        <div className="vip-stat">
          <div className="n">2,268</div>
          <div className="l">深度文章</div>
        </div>
        <div className="vip-stat">
          <div className="n">928</div>
          <div className="l">实战视频</div>
        </div>
        <div className="vip-stat">
          <div className="n">24h</div>
          <div className="l">人工咨询</div>
        </div>
        <div className="vip-stat">
          <div className="n">∞</div>
          <div className="l">远程服务</div>
        </div>
      </section>

      <section className="vip-plans">
        <h2>选择你的会员方案</h2>
        <div className="plan-grid">
          {plans.map((p) => (
            <div key={p.id} className={`plan-card ${p.highlight ? "hot" : ""}`}>
              {p.highlight && <span className="hot-badge">最受欢迎</span>}
              <div className="pname">{p.name}</div>
              <div className="pprice">
                ¥{p.price}
                <small> {p.period}</small>
              </div>
              <ul>
                {p.features.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
              <button className="plan-buy" onClick={() => buy(p.name)}>
                立即开通
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
