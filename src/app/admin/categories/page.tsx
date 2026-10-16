"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminShell } from "../AdminShell";
import { getPosts, type AdminPost } from "../store";

export default function CategoriesPage() {
  const [posts, setPosts] = useState<AdminPost[]>([]);

  useEffect(() => {
    setPosts(getPosts());
  }, []);

  const cats = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of posts) map.set(p.category, (map.get(p.category) ?? 0) + 1);
    return Array.from(map.entries());
  }, [posts]);

  return (
    <AdminShell title="分类管理" active="/admin/categories">
      <div className="panel">
        <div className="panel-head">
          <h3>全部分类（{cats.length}）</h3>
        </div>
        <p style={{ color: "#6b7280", fontSize: 13, marginBottom: 16 }}>
          分类根据文章自动汇总。要调整分类，在文章编辑器里修改每篇文章的「分类」字段即可。
          （上线接后端后，这里会支持直接新建 / 重命名 / 合并分类）
        </p>
        <table className="table">
          <thead>
            <tr>
              <th>分类名</th>
              <th>文章数</th>
            </tr>
          </thead>
          <tbody>
            {cats.map(([name, count]) => (
              <tr key={name}>
                <td>
                  <span className="tag">{name}</span>
                </td>
                <td>{count} 篇</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
