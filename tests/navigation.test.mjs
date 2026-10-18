import test from "node:test";
import assert from "node:assert/strict";
import { publicNavigation } from "../src/lib/navigation.ts";
import { selectChannel } from "../src/lib/catalog.ts";
test("新增三个导航入口且空栏目也有独立路径", () => {
  const links = publicNavigation([]);
  for (const [label, value] of [
    ["教程", "/tutorials"],
    ["随笔", "/notes"],
    ["开源项目", "/projects"],
  ])
    assert.ok(
      links.some((l) => l.label === label && l.value === value),
      label,
    );
});
test("新栏目匹配对应分类或标签，不混入其他文章", () => {
  const items = [
    { title: "a", description: "", category: "教程", tags: [], isVip: false },
    { title: "b", description: "", category: "随笔", tags: [], isVip: false },
    {
      title: "c",
      description: "",
      category: "工具",
      tags: ["开源项目"],
      isVip: false,
    },
  ];
  assert.deepEqual(
    selectChannel(items, "tutorials").map((p) => p.title),
    ["a"],
  );
  assert.deepEqual(
    selectChannel(items, "notes").map((p) => p.title),
    ["b"],
  );
  assert.deepEqual(
    selectChannel(items, "projects").map((p) => p.title),
    ["c"],
  );
});
test("主导航按内容与服务排序，不重复展示会员视频", () => {
  const saved = [
    { id: "nav-4", label: "会员服务", value: "/vip", enabled: true },
    {
      id: "custom-member",
      label: "会员视频",
      value: "/member-videos",
      enabled: true,
    },
  ];
  assert.deepEqual(
    publicNavigation(saved).map((l) => l.label),
    [
      "首页",
      "教程",
      "视频",
      "开源项目",
      "免费资源",
      "随笔",
      "会员",
      "人工咨询",
    ],
  );
});
