# 阿凡达的技术博客

一个用 **Next.js + Markdown** 搭建的技术博客，支持 **Vercel** 和 **群晖 NAS（Docker）** 两种部署方式。

## ✨ 功能

- 📝 用 Markdown 文件写文章，无需数据库
- 🏠 首页文章列表（封面信息、分类、阅读时间）
- 🔍 实时搜索（标题 / 分类 / 标签）
- 📂 文章分类页
- 🌙 深色 / 浅色模式切换（自动记忆）
- 💻 代码块语法高亮、表格、引用等
- 📱 自适应手机 / 电脑

## 📁 项目结构

```
content/posts/        ← 你的文章都放这里（.md 文件）
src/app/              ← 页面（首页、文章、分类、关于）
src/components/       ← 组件（文章列表、主题切换）
src/lib/posts.ts      ← 读取和解析 Markdown 的核心逻辑
Dockerfile            ← 群晖 NAS 部署用
docker-compose.yml    ← 群晖一键启动用
```

## ✍️ 怎么写新文章？

在 `content/posts/` 下新建一个 `.md` 文件，文件名就是网址（如 `my-post.md` → `/posts/my-post`）。开头写好信息：

```markdown
---
title: 文章标题
date: 2026-10-16
description: 一句话摘要，显示在首页
category: 分类名
tags: [标签1, 标签2]
---

正文从这里开始，用 Markdown 写。
```

保存后刷新即可，新文章自动出现在首页，**不用改任何代码**。

## 🖥️ 本地预览

```bash
npm install
npm run dev      # 开发预览，访问 http://localhost:3000
npm run build    # 构建生产版本
npm run start    # 启动生产版本
```

## 🚀 部署方式一：Vercel（海外访问 / 备用）

1. 把本项目推到 GitHub
2. 打开 [vercel.com](https://vercel.com)，用 GitHub 登录
3. Import 这个仓库，一路默认，点 Deploy
4. 几分钟后得到一个网址

> ⚠️ 注意：Vercel 的域名在中国大陆访问可能不稳定，适合海外访问或作为备用。

## 🏠 部署方式二：群晖 NAS（Docker，大陆推荐）

**前置**：群晖 DSM 7.x，已安装「Container Manager」套件。

### 方法 A：用 docker compose（最简单）

1. 把整个项目文件夹上传到 NAS（例如 `/volume1/docker/blog`）
2. 在 Container Manager 里新建「项目」，指向该文件夹的 `docker-compose.yml`
3. 启动。访问 `http://NAS内网IP:3000`

### 方法 B：命令行

```bash
docker build -t avatar-blog .
docker run -d -p 3000:3000 -v $(pwd)/content:/app/content --name blog avatar-blog
```

### 对外访问

- **域名备案**：大陆对外公开访问需要给域名备案
- **内网穿透**：推荐用 Cloudflare Tunnel 或 frp，把 NAS 服务安全暴露到公网
- **反向代理**：群晖「控制面板 → 登录门户 → 高级 → 反向代理」可绑定域名 + HTTPS

> 💡 `content` 目录通过挂载（volume）映射出来，所以在 NAS 上直接改 Markdown 文件就能更新文章，无需重新构建镜像。
```
