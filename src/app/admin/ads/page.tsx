"use client";

import { useEffect, useState } from "react";
import { AdminShell, useAdminReady } from "../AdminShell";
import { getAds, saveAd, deleteAd, type AdSlot } from "../store";
import { useToast } from "../useToast";

function AdsInner() {
  const ready = useAdminReady();
  const [ads, setAds] = useState<AdSlot[]>([]);
  const { show, node } = useToast();

  function refresh() {
    getAds().then(setAds).catch(() => {});
  }
  useEffect(() => {
    if (ready) refresh();
  }, [ready]);

  async function update(ad: AdSlot, patch: Partial<AdSlot>) {
    await saveAd({ ...ad, ...patch });
    refresh();
  }
  async function add() {
    await saveAd({
      id: "ad-" + Date.now(),
      title: "新广告",
      image: "",
      link: "#",
      position: "侧边栏",
      enabled: true,
    });
    refresh();
    show("已添加广告位");
  }
  async function remove(id: string) {
    if (confirm("确定删除这个广告位吗？")) {
      await deleteAd(id);
      refresh();
      show("广告位已删除");
    }
  }

  return (
    <>
      {node}
      <div className="panel">
        <div className="panel-head">
          <h3>广告位（{ads.length}）</h3>
          <button className="btn btn-primary" onClick={add}>
            + 添加广告位
          </button>
        </div>

        {ads.map((ad) => (
          <div className="module-card" key={ad.id}>
            <div className="mh">
              <strong>{ad.title || "(未命名广告)"}</strong>
              <span
                className={`switch ${ad.enabled ? "" : "off"}`}
                style={{ cursor: "pointer" }}
                onClick={() => update(ad, { enabled: !ad.enabled })}
              >
                {ad.enabled ? "展示中" : "已隐藏"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 16 }}>
              {ad.image ? (
                <img
                  src={ad.image}
                  alt=""
                  style={{
                    width: 120,
                    height: 70,
                    objectFit: "cover",
                    borderRadius: 8,
                    flexShrink: 0,
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 120,
                    height: 70,
                    background: "#eef1f4",
                    borderRadius: 8,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "#9ca3af",
                    fontSize: 12,
                  }}
                >
                  无图
                </div>
              )}
              <div style={{ flex: 1 }}>
                <div className="form-row" style={{ marginBottom: 10 }}>
                  <label>广告标题</label>
                  <input
                    value={ad.title}
                    onChange={(e) => update(ad, { title: e.target.value })}
                  />
                </div>
                <div className="form-grid">
                  <div className="form-row" style={{ marginBottom: 10 }}>
                    <label>图片地址</label>
                    <input
                      value={ad.image}
                      onChange={(e) => update(ad, { image: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  <div className="form-row" style={{ marginBottom: 10 }}>
                    <label>点击跳转链接</label>
                    <input
                      value={ad.link}
                      onChange={(e) => update(ad, { link: e.target.value })}
                      placeholder="/vip 或 https://..."
                    />
                  </div>
                </div>
              </div>
            </div>
            <button
              className="btn btn-danger btn-sm"
              onClick={() => remove(ad.id)}
            >
              删除
            </button>
          </div>
        ))}
      </div>

      <div className="panel">
        <p style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.8 }}>
          💡 广告位会显示在前台博客的<b>右侧边栏</b>（图片可点击跳转）。
          可用于推广会员、工具、合作内容等。
        </p>
      </div>
    </>
  );
}

export default function AdsPage() {
  return (
    <AdminShell title="广告位" active="/admin/ads">
      <AdsInner />
    </AdminShell>
  );
}
