---
title: 把博客部署到群晖 NAS（Docker 方式）
date: 2026-10-15
description: 一步步把这个 Next.js 博客用 Docker 跑在你自己的群晖 NAS 上，大陆访问更稳定。
category: 教程
tags: [群晖, Docker, 部署]
cover: https://images.unsplash.com/photo-1591405351990-4726e331f141?w=800&q=80
---

## 为什么用 NAS 部署？

对大陆用户来说，Vercel 访问不稳定。把博客跑在自己的**群晖 NAS**上，数据在自己手里，访问也更可控。

## 前置条件

- 群晖 DSM 7.x，已安装 **Container Manager**（旧版叫 Docker 套件）
- 项目代码已经传到 NAS，或从 GitHub 拉取

## 步骤概览

1. 在群晖套件中心安装 **Container Manager**
2. 把项目文件夹上传到 NAS（含 `Dockerfile`）
3. 用 Container Manager 构建镜像并运行容器
4. 映射端口（例如 `3000`），设置反向代理和域名

## 构建镜像

项目里已经准备好 `Dockerfile`，在项目目录执行：

```bash
docker build -t avatar-blog .
docker run -d -p 3000:3000 --name blog avatar-blog
```

然后访问 `http://你的NAS内网IP:3000` 就能看到博客了。

## 对外访问

- **域名备案**：大陆对外公开访问需要域名备案
- **内网穿透**：可以用 Cloudflare Tunnel 或 frp，把 NAS 服务安全地暴露到公网

详细的图文步骤我会在后面的文章里继续补充。
