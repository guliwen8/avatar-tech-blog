"use client";

import { useEffect, useState } from "react";
import { AdminShell } from "./AdminShell";
import { getPosts, getPlans, getAds, type AdminPost } from "./store";

export default function DashboardPage() {
  const [posts, setPosts] = useState<AdminPost[]>([]);
  const [planCount, setPlanCount] = useState(0);
  const [adCount, setAdCount] = useState(0);

  useEffect(() => {
    setPosts(getPosts());
    setPlanCount(getPlans().length);
    setAdCount(getAds().length);
  }, []);

  const published = posts.filter((p) => p.published).length;

  return (
    <AdminShell title="仪表盘" active="/admin">
      <div className="stat-grid">
        <div className="stat-card">
          <div className="n">{posts.length}</div>
          <div className="l">文章总数</div>
        </div>
        <div className="stat-card">
          <div className="n">{published}</div>
          <div className="l">已发布</div>
        </div>
        <div className="stat-card">
          <div className="n">{planCount}</div>
          <div className="l">会员套餐</div>
        </div>
        <div className="stat-card">
          <div className="n">{adCount}</div>
          <div className="l">广告位</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>最近文章</h3>
          <a href="/admin/posts/edit" className="btn btn-primary btn-sm">
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
            </tr>
          </thead>
          <tbody>
            {posts.slice(0, 5).map((p) => (
              <tr key={p.slug}>
                <td>
                  <a
                    href={`/admin/posts/edit?slug=${p.slug}`}
                    style={{ color: "#24a5db" }}
                  >
                    {p.title}
                  </a>
                </td>
                <td>
                  <span className="tag">{p.category}</span>
                </td>
                <td>{p.date}</td>
                <td>{p.published ? "✅ 已发布" : "📝 草稿"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="panel">
        <h3 style={{ fontSize: 16, marginBottom: 10 }}>👋 欢迎使用管理后台</h3>
        <p style={{ color: "#6b7280", fontSize: 14, lineHeight: 1.8 }}>
          这是后台的<b>界面演示版</b>，数据暂存在浏览器本地，你可以自由体验
          文章的增删改、分类管理、结构模块编辑等全部操作。
          等部署到群晖 NAS 时，接上真实数据库，所有改动就会实时保存并生效。
        </p>
      </div>
    </AdminShell>
  );
}
