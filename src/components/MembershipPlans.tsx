interface Plan {
  id: string;
  name: string;
  price: number;
  period: string;
  features: string[];
  highlight: boolean;
}
export function MembershipPlans({ plans }: { plans: Plan[] }) {
  return (
    <section className="vip-plans" id="plans">
      <div className="section-heading">
        <h2>选择你的会员方案</h2>
        <p>真实在线支付尚未接入。联系站长确认后，由后台设置会员有效期。</p>
      </div>
      {!plans.length && <p>会员方案暂未开放。</p>}
      <div className="plan-grid">
        {plans.map((p) => (
          <div className={`plan-card ${p.highlight ? "hot" : ""}`} key={p.id}>
            {p.highlight && <span className="hot-badge">推荐方案</span>}
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
            <a className="plan-buy" href="/consult">
              咨询开通
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
