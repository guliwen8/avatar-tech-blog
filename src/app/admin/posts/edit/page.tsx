"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { AdminShell, useAdminReady } from "../../AdminShell";
import { getPost, savePost, type AdminPost } from "../../store";
import { useToast } from "../../useToast";

// 把标题转成 slug（只保留英文数字连字符，纯中文用 post-时间戳）
function toSlug(s: string): string {
  const cleaned = s
    .trim()
    .toLowerCase()
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || "post-" + Date.now();
}

function EditForm() {
  const ready = useAdminReady();
  const params = useSearchParams();
  const editSlug = params.get("slug");
  const isEdit = !!editSlug;
  const { show, node } = useToast();

  const [form, setForm] = useState<AdminPost>({
    slug: "",
    title: "",
    date: new Date().toISOString().slice(0, 10),
    category: "教程",
    tags: [],
    description: "",
    cover: "",
    content: "",
    published: true,
    is_vip: false,
    views: 0,
  });

  useEffect(() => {
    if (ready && editSlug) {
      getPost(editSlug).then((p) => {
        if (p) setForm(p);
      }).catch(() => {});
    }
  }, [ready, editSlug]);

  function set<K extends keyof AdminPost>(key: K, val: AdminPost[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function onSave() {
    if (!form.title.trim()) {
      alert("请填写标题");
      return;
    }
    const toSave: AdminPost = {
      ...form,
      slug: form.slug || toSlug(form.title),
    };
    await savePost(toSave);
    show(isEdit ? "文章已更新" : "文章已创建");
    setTimeout(() => {
      window.location.href = "/admin/posts";
    }, 800);
  }

  return (
    <>
      {node}
      <div className="panel">
        <div className="form-row">
          <label>文章标题</label>
          <input
            value={form.title}
            onChange={(e) => set("title", e.target.value)}
            placeholder="输入文章标题"
          />
        </div>

        <div className="form-grid">
          <div className="form-row">
            <label>分类</label>
            <input
              value={form.category}
              onChange={(e) => set("category", e.target.value)}
              placeholder="如：教程 / 随笔"
            />
          </div>
          <div className="form-row">
            <label>发布日期</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => set("date", e.target.value)}
            />
          </div>
        </div>

        <div className="form-grid">
          <div className="form-row">
            <label>标签（逗号分隔）</label>
            <input
              value={form.tags.join(", ")}
              onChange={(e) =>
                set(
                  "tags",
                  e.target.value
                    .split(",")
                    .map((t) => t.trim())
                    .filter(Boolean)
                )
              }
              placeholder="如：Docker, 群晖"
            />
          </div>
          <div className="form-row">
            <label>封面图地址（可留空，自动生成渐变封面）</label>
            <input
              value={form.cover}
              onChange={(e) => set("cover", e.target.value)}
              placeholder="https://..."
            />
          </div>
        </div>

        <div className="form-row">
          <label>摘要</label>
          <input
            value={form.description}
            onChange={(e) => set("description", e.target.value)}
            placeholder="一句话摘要，显示在列表和搜索"
          />
        </div>

        <div className="form-row">
          <label>正文（Markdown）</label>
          <textarea
            value={form.content}
            onChange={(e) => set("content", e.target.value)}
            placeholder="用 Markdown 写正文…&#10;&#10;## 小标题&#10;正文内容&#10;- 列表项"
          />
          <div className="hint">
            支持 Markdown：## 标题、**加粗**、- 列表、```代码块``` 等
          </div>
        </div>

        <div className="form-row">
          <label>
            <input
              type="checkbox"
              checked={form.published}
              onChange={(e) => set("published", e.target.checked)}
              style={{ width: "auto", marginRight: 8 }}
            />
            立即发布（取消勾选则存为草稿）
          </label>
        </div>

        <div className="form-row">
          <label>
            <input
              type="checkbox"
              checked={form.is_vip}
              onChange={(e) => set("is_vip", e.target.checked)}
              style={{ width: "auto", marginRight: 8 }}
            />
            👑 标记为 VIP 会员专属内容
          </label>
        </div>

        <div className="form-actions">
          <button className="btn btn-primary" onClick={onSave}>
            💾 {isEdit ? "保存修改" : "创建文章"}
          </button>
          <a href="/admin/posts" className="btn btn-ghost">
            取消
          </a>
        </div>
      </div>
    </>
  );
}

export default function EditPage() {
  return (
    <AdminShell title="文章编辑器" active="/admin/posts">
      <Suspense fallback={<div className="panel">加载中…</div>}>
        <EditForm />
      </Suspense>
    </AdminShell>
  );
}
