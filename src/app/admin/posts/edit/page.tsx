"use client";

import { EditorialWorkbench } from "@/components/EditorialWorkbench";
import type { EditorialCandidate } from "@/lib/editorial";
import { ContentFields } from "@/components/ContentFields";
import { validateDetailsForPublication } from "@/lib/content-details";
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
    details: { kind: "auto" },
    slug: "",
    title: "",
    date: new Date().toISOString().slice(0, 10),
    category: "教程",
    tags: [],
    description: "",
    cover: "",
    content: "",
    published: false,
    is_vip: false,
    views: 0,
  });

  const [beforeEditorial, setBeforeEditorial] = useState<AdminPost | null>(
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (ready && editSlug) {
      getPost(editSlug)
        .then((p) => {
          if (p) setForm(p);
        })
        .catch(() => {});
    }
  }, [ready, editSlug]);

  function set<K extends keyof AdminPost>(key: K, val: AdminPost[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function adopt(candidate: EditorialCandidate) {
    if (
      form.content.trim() &&
      form.content !== candidate.content &&
      !window.confirm(
        "采用候选稿会替换当前正文、标题和摘要，并取消立即发布；原始素材保留。是否继续？",
      )
    )
      return;
    setBeforeEditorial(form);
    setForm((f) => ({ ...f, ...candidate, published: false }));
  }

  async function onSave() {
    if (uploading) return;
    if (!form.title.trim()) {
      alert("请填写标题");
      return;
    }
    if (form.published && !form.content.trim()) {
      setSaveError("请先采用候选稿或填写正式正文，再发布文章");
      return;
    }
    if (
      form.published &&
      !window.confirm(
        "确认按所选访问权限发布这篇文章？请确保已核对正文与来源。",
      )
    )
      return;
    const toSave: AdminPost = {
      ...form,
      slug: form.slug || toSlug(form.title),
    };
    setSaving(true);
    setSaveError("");
    try {
      toSave.details = validateDetailsForPublication(
        toSave.details,
        toSave.published,
      );
      await savePost(toSave);
      show(isEdit ? "文章已更新" : "文章已创建");
      setTimeout(() => {
        window.location.href = "/admin/posts";
      }, 800);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "保存失败，请重试");
      setSaving(false);
    }
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
                    .filter(Boolean),
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

        <ContentFields
          onUploadingChange={setUploading}
          value={form.details}
          onChange={(value) => set("details", value)}
        />

        <EditorialWorkbench
          value={form.editorial}
          current={{
            title: form.title,
            description: form.description,
            content: form.content,
          }}
          onChange={(value) => set("editorial", value)}
          onAdopt={adopt}
        />
        {beforeEditorial && (
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              if (
                window.confirm(
                  "撤销采用会恢复采用前的标题、摘要与正文，是否继续？",
                )
              ) {
                setForm((f) => ({
                  ...f,
                  title: beforeEditorial.title,
                  description: beforeEditorial.description,
                  content: beforeEditorial.content,
                  published: false,
                }));
                setBeforeEditorial(null);
              }
            }}
          >
            撤销本次采用
          </button>
        )}
        <div className="form-row">
          <label htmlFor="post-content">正文（Markdown）</label>
          <textarea
            id="post-content"
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
            确认发布（默认保存为草稿）
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
            👑 显示 VIP 角标（正文权限请在上方单独设置）
          </label>
        </div>

        {saveError && (
          <p role="alert" className="save-error">
            {saveError}
          </p>
        )}
        <div className="form-actions">
          <button
            className="btn btn-primary"
            disabled={saving || uploading}
            onClick={onSave}
          >
            {uploading
              ? "文件上传中…"
              : saving
                ? "保存中…"
                : form.published
                  ? isEdit
                    ? "更新并发布"
                    : "发布文章"
                  : "保存草稿"}
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
