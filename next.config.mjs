import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' 让 next build 产出一个独立运行包，Docker 部署到群晖 NAS 时体积小。
  output: "standalone",
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
  // SQLite 只从运行时持久化目录读取，不能被追踪进部署包。
  outputFileTracingExcludes: { "/*": ["./data/**/*"] },
  reactStrictMode: true,
  // better-sqlite3 是原生模块，不能被打包，需标为外部依赖
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
