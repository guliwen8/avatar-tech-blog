import type { Post } from "@/lib/posts";
import { contentKind } from "@/lib/catalog";
import { VideoPlayer } from "./VideoPlayer";
export function ContentPanel({ post }: { post: Post }) {
  const kind = contentKind(post),
    d = post.details;
  if (!d || kind === "article") return null;
  const info =
    kind === "video"
      ? [["时长", d.duration]]
      : kind === "resource"
        ? [
            ["版本", d.version],
            ["适用平台", d.platform],
          ]
        : [
            ["版本", d.version],
            ["许可证", d.license],
            ["运行环境", d.environment],
          ];
  const links =
    kind === "video"
      ? [["前往原平台观看", d.sourceUrl]]
      : kind === "resource"
        ? [
            ["前往下载", d.downloadUrl],
            ["查看资源来源", d.sourceUrl],
          ]
        : [
            ["查看代码仓库", d.repoUrl],
            ["在线演示", d.demoUrl],
          ];
  if (!info.some(([, v]) => v) && !links.some(([, v]) => v) && !d.videoUrl)
    return null;
  return (
    <section
      className="content-panel"
      aria-label={
        kind === "video"
          ? "视频资料"
          : kind === "resource"
            ? "资源资料"
            : "项目资料"
      }
    >
      <div className="content-panel-heading">
        <span>
          {kind === "video"
            ? "视频教程"
            : kind === "resource"
              ? "免费资源"
              : "开源项目"}
        </span>
        <h2>
          {kind === "video"
            ? "观看与资料"
            : kind === "resource"
              ? "资源信息"
              : "项目信息"}
        </h2>
      </div>
      {kind === "video" && d.videoUrl && (
        <VideoPlayer src={d.videoUrl} poster={post.cover} />
      )}
      {info.some(([, v]) => v) && (
        <dl>
          {info
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
        </dl>
      )}
      {links.some(([, v]) => v) && (
        <div className="content-actions">
          {links
            .filter(([, v]) => v)
            .map(([label, href]) => (
              <a
                className="btn"
                key={label}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {label} ↗
              </a>
            ))}
        </div>
      )}
      {kind === "resource" && (
        <p className="content-note">
          文件由来源网站提供，版本与使用说明以来源页面为准。
        </p>
      )}
    </section>
  );
}
