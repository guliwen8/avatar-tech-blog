# ===== 阶段 1：安装依赖 =====
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

# ===== 阶段 2：构建 =====
FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ===== 阶段 3：运行（体积最小）=====
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# standalone 模式产出的最小运行包
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
# 文章内容目录（Markdown 文件）
COPY --from=builder /app/content ./content

EXPOSE 3000
CMD ["node", "server.js"]
