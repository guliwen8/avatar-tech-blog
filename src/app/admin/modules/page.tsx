"use client";

import { useEffect, useState } from "react";
import { AdminShell, useAdminReady } from "../AdminShell";
import {
  getModules,
  saveModule,
  deleteModule,
  type SiteModule,
} from "../store";
import { useToast } from "../useToast";

function ModulesInner() {
  const ready = useAdminReady();
  const [mods, setMods] = useState<SiteModule[]>([]);
  const { show, node } = useToast();

  function refresh() {
    getModules().then(setMods).catch(() => {});
  }
  useEffect(() => {
    if (ready) refresh();
  }, [ready]);

  async function update(mod: SiteModule, patch: Partial<SiteModule>) {
    await saveModule({ ...mod, ...patch });
    refresh();
    show("模块已更新");
  }

  async function add(type: "nav" | "sidebar") {
    const id = type + "-" + Date.now();
    await saveModule({
      id,
      type,
      label: type === "nav" ? "新菜单" : "新卡片标题",
      value: type === "nav" ? "/" : "卡片说明文字",
      enabled: true,
    });
    refresh();
    show("已添加模块");
  }

  async function remove(id: string) {
    if (confirm("确定删除这个模块吗？")) {
      await deleteModule(id);
      refresh();
      show("模块已删除");
    }
  }

  const navMods = mods.filter((m) => m.type === "nav");
  const sideMods = mods.filter((m) => m.type === "sidebar");

  function renderCard(mod: SiteModule) {
    return (
      <div className="module-card" key={mod.id}>
        <div className="mh">
          <strong>{mod.label || "(未命名)"}</strong>
          <span
            className={`switch ${mod.enabled ? "" : "off"}`}
            style={{ cursor: "pointer" }}
            onClick={() => update(mod, { enabled: !mod.enabled })}
          >
            {mod.enabled ? "已启用" : "已隐藏"}
          </span>
        </div>
        <div className="form-grid">
          <div className="form-row" style={{ marginBottom: 0 }}>
            <label>{mod.type === "nav" ? "菜单名称" : "卡片标题"}</label>
            <input
              value={mod.label}
              onChange={(e) => update(mod, { label: e.target.value })}
            />
          </div>
          <div className="form-row" style={{ marginBottom: 0 }}>
            <label>{mod.type === "nav" ? "链接地址" : "说明文字"}</label>
            <input
              value={mod.value}
              onChange={(e) => update(mod, { value: e.target.value })}
            />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => remove(mod.id)}
          >
            删除
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {node}

      <div className="panel">
        <div className="panel-head">
          <h3>🧭 顶部导航菜单</h3>
          <button className="btn btn-primary btn-sm" onClick={() => add("nav")}>
            + 添加菜单
          </button>
        </div>
        {navMods.map(renderCard)}
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>📎 右侧边栏卡片</h3>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => add("sidebar")}
          >
            + 添加卡片
          </button>
        </div>
        {sideMods.map(renderCard)}
      </div>

      <div className="panel">
        <p style={{ color: "#6b7280", fontSize: 13, lineHeight: 1.8 }}>
          💡 这里可以增删改博客的<b>结构模块</b>：顶部导航菜单项、右侧边栏的推广卡片。
          保存后实时作用到前台网站。
        </p>
      </div>
    </>
  );
}

export default function ModulesPage() {
  return (
    <AdminShell title="结构模块" active="/admin/modules">
      <ModulesInner />
    </AdminShell>
  );
}
