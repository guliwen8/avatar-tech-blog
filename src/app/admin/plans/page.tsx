"use client";

import { useEffect, useState } from "react";
import { AdminShell, useAdminReady } from "../AdminShell";
import { getPlans, savePlan, deletePlan, type MemberPlan } from "../store";
import { useToast } from "../useToast";

function PlansInner() {
  const ready = useAdminReady();
  const [plans, setPlans] = useState<MemberPlan[]>([]);
  const { show, node } = useToast();

  function refresh() {
    getPlans().then(setPlans).catch(() => {});
  }
  useEffect(() => {
    if (ready) refresh();
  }, [ready]);

  async function update(plan: MemberPlan, patch: Partial<MemberPlan>) {
    await savePlan({ ...plan, ...patch });
    refresh();
  }
  async function add() {
    await savePlan({
      id: "plan-" + Date.now(),
      name: "新套餐",
      price: 99,
      period: "/月",
      features: ["权益一", "权益二"],
      highlight: false,
      enabled: true,
    });
    refresh();
    show("已添加套餐");
  }
  async function remove(id: string) {
    if (confirm("确定删除这个套餐吗？")) {
      await deletePlan(id);
      refresh();
      show("套餐已删除");
    }
  }

  return (
    <>
      {node}
      <div className="panel">
        <div className="panel-head">
          <h3>会员套餐（{plans.length}）</h3>
          <button className="btn btn-primary" onClick={add}>
            + 添加套餐
          </button>
        </div>

        {plans.map((p) => (
          <div className="module-card" key={p.id}>
            <div className="mh">
              <strong>
                {p.name} · ¥{p.price}
                {p.period}
              </strong>
              <div style={{ display: "flex", gap: 8 }}>
                <span
                  className={`switch ${p.highlight ? "" : "off"}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => update(p, { highlight: !p.highlight })}
                >
                  {p.highlight ? "⭐ 推荐" : "普通"}
                </span>
                <span
                  className={`switch ${p.enabled ? "" : "off"}`}
                  style={{ cursor: "pointer" }}
                  onClick={() => update(p, { enabled: !p.enabled })}
                >
                  {p.enabled ? "已启用" : "已隐藏"}
                </span>
              </div>
            </div>
            <div className="form-grid">
              <div className="form-row" style={{ marginBottom: 12 }}>
                <label>套餐名</label>
                <input
                  value={p.name}
                  onChange={(e) => update(p, { name: e.target.value })}
                />
              </div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <label>价格（元）</label>
                <input
                  type="number"
                  value={p.price}
                  onChange={(e) => update(p, { price: Number(e.target.value) })}
                />
              </div>
            </div>
            <div className="form-grid">
              <div className="form-row" style={{ marginBottom: 12 }}>
                <label>周期（如 /月 /年 永久）</label>
                <input
                  value={p.period}
                  onChange={(e) => update(p, { period: e.target.value })}
                />
              </div>
              <div className="form-row" style={{ marginBottom: 12 }}>
                <label>权益（逗号分隔）</label>
                <input
                  value={p.features.join(", ")}
                  onChange={(e) =>
                    update(p, {
                      features: e.target.value
                        .split(",")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    })
                  }
                />
              </div>
            </div>
            <button className="btn btn-danger btn-sm" onClick={() => remove(p.id)}>
              删除
            </button>
          </div>
        ))}
      </div>

      <div className="panel">
        <p style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.8 }}>
          💡 这里管理会员付费套餐，改动会显示在前台
          <a href="/vip" target="_blank" style={{ color: "#24a5db" }}>
            {" "}会员页 /vip
          </a>
          。支付收款（微信 / 支付宝）将在接入支付接口后开通。
        </p>
      </div>
    </>
  );
}

export default function PlansPage() {
  return (
    <AdminShell title="会员套餐" active="/admin/plans">
      <PlansInner />
    </AdminShell>
  );
}
