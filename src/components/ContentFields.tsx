"use client";
import { FileUploader } from "./FileUploader";
import type { ContentDetails, ContentKind } from "@/lib/content-details";
export function ContentFields({
  value = { kind: "auto" },
  onChange,
  onUploadingChange,
}: {
  value?: ContentDetails;
  onChange: (value: ContentDetails) => void;
  onUploadingChange?: (busy: boolean) => void;
}) {
  const set = (key: keyof ContentDetails, text: string) =>
    onChange({ ...value, [key]: text });
  const field = (
    key: keyof ContentDetails,
    label: string,
    placeholder: string,
  ) => (
    <label className="form-row" key={key}>
      {label}
      <input
        value={value[key] || ""}
        onChange={(e) => set(key, e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
  return (
    <fieldset className="content-fields">
      <legend>内容类型与资料</legend>
      <label className="form-row">
        内容类型
        <select
          aria-label="内容类型"
          value={value.kind}
          onChange={(e) =>
            onChange({ ...value, kind: e.target.value as ContentKind })
          }
        >
          <option value="auto">自动识别（兼容旧文章）</option>
          <option value="article">普通文章</option>
          <option value="video">视频</option>
          <option value="resource">免费资源</option>
          <option value="project">开源项目</option>
        </select>
      </label>
      <label className="form-row">
        正文访问权限
        <select
          aria-label="正文访问权限"
          value={value.access || "public"}
          onChange={(e) =>
            onChange({
              ...value,
              access: e.target.value as ContentDetails["access"],
            })
          }
        >
          <option value="public">公开（所有人可读）</option>
          <option value="login">登录后可读（免费注册）</option>
          <option value="member">有效会员可读</option>
        </select>
      </label>
      <p className="hint">
        本站上传的文件跟随文章权限，上传后请保存文章。外部链接仍由来源站控制。教程和随笔仍按分类显示。
      </p>
      {value.kind === "video" && (
        <>
          {field(
            "videoUrl",
            "视频播放地址",
            "上传后自动填写，或输入 HTTPS 视频文件地址",
          )}
          <FileUploader
            onBusyChange={onUploadingChange}
            purpose="post"
            label="上传本地视频"
            accept=".mp4,.webm"
            maxMB={100}
            onUploaded={(file) => set("videoUrl", file.url)}
          />
          {field("sourceUrl", "原平台链接", "https://...")}
          {field("duration", "视频时长", "例如：12:30")}
          <p className="hint">
            平台网页链接请填“原平台链接”，不填入播放地址。两个地址至少填写一个。
          </p>
        </>
      )}
      {value.kind === "resource" && (
        <>
          {field("version", "资源版本", "例如：v1.0")}
          {field("platform", "适用平台", "例如：Windows / macOS")}
          {field("downloadUrl", "下载地址", "上传后自动填写，或 https://...")}
          <FileUploader
            onBusyChange={onUploadingChange}
            purpose="post"
            label="上传下载文件"
            accept=".pdf,.zip,.7z"
            maxMB={50}
            onUploaded={(file) => set("downloadUrl", file.url)}
          />
          {field("sourceUrl", "资源来源", "https://...")}
        </>
      )}
      {value.kind === "project" && (
        <>
          {field("repoUrl", "代码仓库", "https://github.com/...")}
          {field("demoUrl", "在线演示", "https://...")}
          {field("license", "许可证", "例如：MIT / Apache-2.0")}
          {field("environment", "运行环境", "例如：Node.js 22 / Docker")}
          {field("version", "项目版本", "例如：v1.0")}
        </>
      )}
    </fieldset>
  );
}
