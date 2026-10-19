import https from "node:https";
import { lookup } from "node:dns/promises";
import { BlockList, isIP } from "node:net";
import fs from "node:fs";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
const blocked = new BlockList();
for (const [a, n] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
])
  blocked.addSubnet(a, n, "ipv4");
for (const [a, n] of [
  ["::", 128],
  ["::1", 128],
  ["fc00::", 7],
  ["fe80::", 10],
  ["fec0::", 10],
  ["ff00::", 8],
  ["2001:db8::", 32],
  ["2002::", 16],
  ["2001::", 32],
])
  blocked.addSubnet(a, n, "ipv6");
export function publicAddress(address, family) {
  return (
    !!isIP(address) &&
    (family !== 6 || /^[23]/i.test(address)) &&
    !blocked.check(address, family === 6 ? "ipv6" : "ipv4")
  );
}
export function sourceUrl(raw) {
  const u = new URL(raw);
  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    (u.port && u.port !== "443") ||
    isIP(u.hostname.replace(/^\[|\]$/g, "")) ||
    !u.hostname.includes(".") ||
    /\.(local|localhost|internal|test)$/i.test(u.hostname)
  )
    throw Error(
      "仅支持公网 HTTPS 链接，不允许本机、内网、IP 或含账号密码的地址",
    );
  u.hash = "";
  return u;
}
/** Public-only HTTPS request. Pins verified DNS addresses and checks every redirect. */
export async function publicRequest(
  raw,
  options = {},
  deps = { lookup, request: https.request },
) {
  const url = sourceUrl(raw),
    addresses = await deps.lookup(url.hostname, { all: true });
  if (
    !addresses.length ||
    addresses.some((a) => !publicAddress(a.address, a.family))
  )
    throw Error("来源域名解析到非公网地址，已拒绝");
  const {
    signal,
    maxBytes = 4 * 1024 * 1024,
    saveTo,
    method = "GET",
    body,
    headers = {},
    redirects = 3,
    timeoutMs = 30000,
  } = options;
  if (signal?.aborted) throw Error("任务已取消");
  return new Promise((resolve, reject) => {
    const req = deps.request(
      url,
      {
        method,
        headers: {
          "User-Agent": "AvatarBlog/1.0",
          "Accept-Encoding": "identity",
          ...headers,
        },
        lookup: (_host, opts, callback) =>
          opts.all
            ? callback(null, addresses)
            : callback(null, addresses[0].address, addresses[0].family),
      },
      async (res) => {
        if (
          res.statusCode >= 300 &&
          res.statusCode < 400 &&
          res.headers.location
        ) {
          res.resume();
          if (redirects <= 0 || method !== "GET" || headers.Authorization) {
            reject(Error("来源重定向不受支持"));
            return;
          }
          try {
            resolve(
              await publicRequest(
                new URL(res.headers.location, url).href,
                { ...options, redirects: redirects - 1 },
                deps,
              ),
            );
          } catch (e) {
            reject(e);
          }
          return;
        }
        if (res.statusCode < 200 || res.statusCode >= 300) {
          res.resume();
          reject(Error(`来源服务返回 HTTP ${res.statusCode}`));
          return;
        }
        if (Number(res.headers["content-length"]) > maxBytes) {
          res.destroy();
          reject(Error("来源文件超过允许大小"));
          return;
        }
        let count = 0;
        const chunks = [];
        const limiter = new Transform({
          transform(chunk, _encoding, cb) {
            count += chunk.length;
            if (count > maxBytes) cb(Error("来源文件超过允许大小"));
            else cb(null, chunk);
          },
        });
        try {
          if (saveTo) {
            await pipeline(
              res,
              limiter,
              fs.createWriteStream(saveTo, { flags: "wx", mode: 0o600 }),
            );
            resolve({ body: Buffer.alloc(0), finalUrl: url.href, size: count });
          } else {
            limiter.on("data", (chunk) => chunks.push(chunk));
            await pipeline(res, limiter);
            resolve({
              body: Buffer.concat(chunks),
              finalUrl: url.href,
              size: count,
            });
          }
        } catch (e) {
          reject(e);
        }
      },
    );
    const timer = setTimeout(
      () => req.destroy(Error("来源请求超时")),
      timeoutMs,
    );
    const cancel = () => req.destroy(Error("任务已取消"));
    signal?.addEventListener("abort", cancel, { once: true });
    req.on("close", () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", cancel);
    });
    req.on("error", (e) =>
      reject(
        Error(
          e.message.startsWith("来源") || e.message === "任务已取消"
            ? e.message
            : "无法连接素材来源，请检查链接或网络",
        ),
      ),
    );
    req.end(body);
  });
}
