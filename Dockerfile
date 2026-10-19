# ===== 阶段 1：安装依赖（含原生模块 better-sqlite3 的编译）=====
# 使用国内镜像源，避免大陆拉取 Docker Hub 超时
FROM docker.m.daocloud.io/library/node:22-alpine AS deps
WORKDIR /app
# 原生模块编译需要这些工具
RUN apk add --no-cache python3 make g++ libc6-compat
COPY package.json package-lock.json* ./
# 使用 npm 国内镜像源 + 加大重试超时，避免大陆 npm 安装超时
RUN npm config set registry https://registry.npmmirror.com \
    && npm config set fetch-retries 5 \
    && npm config set fetch-retry-mintimeout 20000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-timeout 120000 \
    && npm install --no-audit --no-fund

# ===== 阶段 2：构建 =====
FROM docker.m.daocloud.io/library/node:22-alpine AS builder
WORKDIR /app
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# 确保 public 目录存在（项目没有 public 时构建会报错）
RUN mkdir -p public
RUN npm run build

# ===== 阶段 3：运行 =====
FROM docker.m.daocloud.io/library/node:22-alpine AS runner
WORKDIR /app
RUN apk add --no-cache libc6-compat python3 py3-pip ffmpeg \
    && python3 -m venv /opt/video-tools \
    && /opt/video-tools/bin/pip install --no-cache-dir --index-url https://pypi.tuna.tsinghua.edu.cn/simple 'yt-dlp[default]==2026.3.17'
ENV PATH="/opt/video-tools/bin:$PATH"
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# 数据库文件放在持久化目录（NAS 上挂载 volume 到这里）
ENV DB_PATH=/app/data/blog.db

# standalone 运行包
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# standalone 不含 better-sqlite3 原生模块，单独拷贝
COPY --from=builder /app/node_modules/better-sqlite3 ./node_modules/better-sqlite3
COPY --from=builder /app/node_modules/bindings ./node_modules/bindings
COPY --from=builder /app/node_modules/file-uri-to-path ./node_modules/file-uri-to-path

# 持久化数据目录
RUN mkdir -p /app/data
VOLUME ["/app/data"]

EXPOSE 3000
CMD ["node", "server.js"]
