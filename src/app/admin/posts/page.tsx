"use client";

import { useEffect, useState } from "react";
import { AdminShell, useAdminReady } from "../AdminShell";
import { getPosts, deletePost, type AdminPost } from "../store";
import { useToast } from "../useToast";

function PostsInner() {
  const ready = useAdminReady();
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const { show, node } = useToast();

  function refresh() {
    getPosts().then(setPosts).catch(() => {});
  }
  useEffect(() => {
    if (ready) refresh();
  }, [ready]);

  async function onDelete(slug: string, title: string) {
    if (confirm(`确定删除文章「${title}」吗？此操作不可撤销。`)) {
      await deletePost(slug);
      refresh();
      show("文章已删除");
    }
  }

  return (
    <>
      {node}
      <div className="panel">
        <div className="panel-head">
          <h3>全部文章（{posts.length}）</h3>
          <a href="/admin/posts/edit" className="btn btn-primary">
            ✏️ 写新文章
          </a>
        </div>
        <table className="table">
          <thead>
            <tr>
              <th>标题</th>
              <th>分类</th>
              <th>日期</th>
              <th>状态</th>
              <th style={{ width: 160 }}>操作</th>
            </tr>
          </thead>
          <tbody>
            {posts.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "#999" }}>
                  还没有文章，点右上角「写新文章」开始
                </td>
              </tr>
            ) : (
              posts.map((p) => (
                <tr key={p.slug}>
                  <td>{p.title}</td>
                  <td>
                    <span className="tag">{p.category}</span>
                  </td>
                  <td>{p.date}</td>
                  <td>{p.published ? "✅ 已发布" : "📝 草稿"}</td>
                  <td>
                    <div className="actions">
                      <a
                        href={`/admin/posts/edit?slug=${p.slug}`}
                        className="btn btn-ghost btn-sm"
                      >
                        编辑
                      </a>
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => onDelete(p.slug, p.title)}
                      >
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function PostsPage() {
  return (
    <AdminShell title="文章管理" active="/admin/posts">
      <PostsInner />
    </AdminShell>
  );
}
