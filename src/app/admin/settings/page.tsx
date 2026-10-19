"use client";

import { useEffect, useState } from "react";
import { AdminShell, useAdminReady } from "../AdminShell";
import { getSettings, saveSettings } from "../store";
import { useToast } from "../useToast";

function SettingsInner() {
  const ready = useAdminReady();
  const { show, node } = useToast();
  const [siteName, setSiteName] = useState("阿凡达博客");
  const [sub, setSub] = useState("技术折腾笔记");
  const [desc, setDesc] = useState("");
  const [primary, setPrimary] = useState("#24a5db");
  const [contactEmail, setContactEmail] = useState("");
  const [consultationUrl, setConsultationUrl] = useState("");
  const [newPwd, setNewPwd] = useState("");

  useEffect(() => {
    if (!ready) return;
    getSettings()
      .then((s) => {
        if (s.siteName) setSiteName(s.siteName);
        if (s.siteSub) setSub(s.siteSub);
        if (s.siteDesc) setDesc(s.siteDesc);
        if (s.primaryColor) setPrimary(s.primaryColor);
        setContactEmail(s.contactEmail || "");
        setConsultationUrl(s.consultationUrl || "");
      })
      .catch(() => {});
  }, [ready]);

  async function saveBasic() {
    await saveSettings({
      siteName,
      siteSub: sub,
      siteDesc: desc,
      primaryColor: primary,
      contactEmail: contactEmail.trim(),
      consultationUrl: consultationUrl.trim(),
    });
    show("设置已保存");
  }

  async function savePwd() {
    if (newPwd.length < 10) {
      alert("密码至少 10 位");
      return;
    }
    try {
      await saveSettings({ newPassword: newPwd });
      setNewPwd("");
      window.location.assign("/admin?passwordChanged=1");
    } catch (error) {
      show(error instanceof Error ? error.message : "修改失败");
    }
  }

  return (
    <>
      {node}
      <div className="panel">
        <div className="panel-head">
          <h3>基本信息</h3>
        </div>
        <div className="form-grid">
          <div className="form-row">
            <label>站点名称</label>
            <input
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
            />
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
        <div className="form-grid">
          <div className="form-row">
            <label htmlFor="contact-email">联系邮箱（选填）</label>
            <input
              id="contact-email"
              type="email"
              value={contactEmail}
              onChange={(e) => setContactEmail(e.target.value)}
              placeholder="用于人工咨询页面"
            />
          </div>
          <div className="form-row">
            <label htmlFor="consultation-url">
              咨询渠道链接（选填，HTTPS）
            </label>
            <input
              id="consultation-url"
              type="url"
              value={consultationUrl}
              onChange={(e) => setConsultationUrl(e.target.value)}
              placeholder="https://"
            />
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={saveBasic}>
            💾 保存设置
          </button>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>🔐 修改登录密码</h3>
        </div>
        <div className="form-row">
          <label htmlFor="admin-new-password">新密码（至少 10 位）</label>
          <input
            id="admin-new-password"
            autoComplete="new-password"
            type="password"
            value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)}
            placeholder="输入新密码"
          />
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={savePwd}>
            🔑 修改密码
          </button>
        </div>
      </div>
    </>
  );
}

export default function SettingsPage() {
  return (
    <AdminShell title="站点设置" active="/admin/settings">
      <SettingsInner />
    </AdminShell>
  );
}
