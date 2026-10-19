"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { EditorialWorkbench } from "./EditorialWorkbench";
import {
  normalizeEditorial,
  type EditorialData,
  type EditorialCandidate,
} from "@/lib/editorial";
import { savePost } from "@/app/admin/store";
export function TextMaterialIntake() {
  const router = useRouter();
  const [data, setData] = useState<EditorialData>(() => normalizeEditorial({}));
  const [adopted, setAdopted] = useState<EditorialCandidate>({
    title: "",
    description: "",
    content: "",
  });
  const [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  async function save() {
    setSaving(true);
    setError("");
    try {
      const result = await savePost({
        slug: "material-" + crypto.randomUUID(),
        title: adopted.title || data.candidate?.title || "待整理素材",
        description: adopted.description,
        date: new Date().toISOString().slice(0, 10),
        category: data.template === "note" ? "随笔" : "教程",
        tags: [],
        cover: "",
        content: adopted.content,
        published: false,
        is_vip: false,
        views: 0,
        details: { kind: "article", access: "public" },
        editorial: data,
      });
      router.push("/admin/posts/edit?slug=" + encodeURIComponent(result.slug));
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }
  return (
    <section aria-label="文字素材整理">
      <div className="panel">
        <h2>粘贴杂乱素材，整理成文章</h2>
        <p>
          把文档、笔记或多段资料复制到「原始素材」。AI
          整理结构与表达，保留原稿，生成候选稿供你核对；采用后保存草稿，再到文章编辑页确认发布。
        </p>
      </div>
      <EditorialWorkbench
        value={data}
        current={adopted}
        onChange={setData}
        onAdopt={(candidate) => {
          setAdopted(candidate);
          setError("");
        }}
      />
      <div className="panel">
        <p>
          {adopted.content
            ? "已采用候选稿，保存后可继续编辑标题、分类与正文。"
            : "可先保存素材和候选稿，稍后继续审核；未采用的候选稿不会写入正式正文。"}
        </p>
        <button
          className="btn btn-primary"
          disabled={saving || (!data.source.trim() && !data.candidate?.content)}
          onClick={save}
        >
          {saving ? "保存中…" : "保存草稿并继续编辑"}
        </button>
        <p role="status">{error}</p>
      </div>
    </section>
  );
}
