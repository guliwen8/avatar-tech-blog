/** @type {import('next').NextConfig} */
const nextConfig = {
  // 'standalone' 让 next build 产出一个独立运行包，Docker 部署到群晖 NAS 时体积小、不依赖 node_modules。
  // Vercel 部署会忽略这个设置，照常工作。
  output: "standalone",
  reactStrictMode: true,
};

export default nextConfig;
