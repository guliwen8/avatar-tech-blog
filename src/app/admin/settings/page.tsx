"use client";

import { useState } from "react";
import { AdminShell } from "../AdminShell";
import { useToast } from "../useToast";

export default function SettingsPage() {
  const { show, node } = useToast();
  const [siteName, setSiteName] = useState("阿凡达博客");
  const [sub, setSub] = useState("技术折腾笔记");
  const [desc, setDesc] = useState("分享技术教程、折腾笔记与踩坑经验");
  const [primary, setPrimary] = useState("#24a5db");

  return (
    <AdminShell title="站点设置" active="/admin/settings">
      {node}
      <div className="panel">
        <div className="panel-head">
          <h3>基本信息</h3>
        </div>

        <div className="form-grid">
          <div className="form-row">
            <label>站点名称</label>
            <input value={siteName} onChange={(e) => setSiteName(e.target.value)} />
          </div>
          <div className="form-row">
            <label>副标题</label>
            <input value={sub} onChange={(e) => setSub(e.target.value)} />
          </div>
        </div>

        <div className="form-row">
          <label>站点描述</label>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} />
        </div>

        <div className="form-row">
          <label>主题色</label>
          <input
            type="color"
            value={primary}
            onChange={(e) => setPrimary(e.target.value)}
            style={{ width: 80, height: 40, padding: 4 }}
          />
          <span style={{ marginLeft: 10, color: "#6b7280", fontSize: 13 }}>
            {primary}
          </span>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" onClick={() => show("设置已保存")}>
            💾 保存设置
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>🔐 登录密码</h3>
        </div>
        <p style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.8 }}>
          当前为演示版，使用固定演示密码登录。上线接后端（部署到群晖 NAS）后，
          这里会支持设置你自己的安全账号密码，并启用真正的服务端登录保护。
        </p>
      </div>
    </AdminShell>
  );
}
