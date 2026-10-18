import type { SiteModule } from "@/server/repo";
const defaults = [
  { label: "首页", value: "/" },
  { label: "教程", value: "/tutorials" },
  { label: "视频", value: "/videos" },
  { label: "开源项目", value: "/projects" },
  { label: "免费资源", value: "/resources" },
  { label: "随笔", value: "/notes" },
  { label: "会员", value: "/vip" },
  { label: "人工咨询", value: "/consult" },
];
// 展示层兼容旧 seed 菜单；不写数据库，自定义菜单和禁用状态仍生效。
export function publicNavigation(modules: SiteModule[]) {
  const legacy: Record<string, string> = {
    "nav-2": "分类",
    "nav-3": "教程",
    "nav-5": "关于",
  };
  const active = modules.filter(
    (m) =>
      m.enabled &&
      m.value !== "/member-videos" &&
      !(
        legacy[m.id] === m.label && ["/categories", "/about"].includes(m.value)
      ),
  );
  const disabled = new Set(
    modules.filter((m) => !m.enabled).map((m) => m.value),
  );
  const primary = defaults
    .filter((d) => !disabled.has(d.value))
    .map((d) => {
      const saved = active.find((m) => m.value === d.value);
      return {
        label:
          d.value === "/vip" &&
          ["会员", "会员服务"].includes(saved?.label || "")
            ? "会员"
            : saved?.label || d.label,
        value: d.value,
      };
    });
  return [
    ...primary,
    ...active
      .filter((m) => !defaults.some((d) => d.value === m.value))
      .map((m) => ({ label: m.label, value: m.value })),
  ];
}
