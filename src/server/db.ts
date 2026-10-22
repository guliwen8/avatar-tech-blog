import {migrateWebImports} from "./web-imports";
import { migrateLocalVideos } from "./local-video";
import { migrateVideoJobs } from "./video-jobs";
import { migrateEditorial } from "./editorial-migration";
import { migrateFiles } from "./private-files";
import { migrateCommunity } from "./community";
import { migratePostDetails } from "./post-migration";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import path from "path";
import fs from "fs";

// 数据库文件位置：
// - 可用环境变量 DB_PATH 指定（NAS 上会挂载到持久化目录）
// - 默认放在项目根的 data/ 目录
const DB_PATH =
  process.env.DB_PATH || path.join(process.cwd(), "data", "blog.db");

// 确保 data 目录存在
fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

// 单例数据库连接
let _db: Database.Database | null = null;

export function getDB(): Database.Database {
  if (_db) return _db;
  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL"); // 更好的并发性能
  init(_db);
  return _db;
}

// 建表 + 初始化数据
function init(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      slug        TEXT PRIMARY KEY,
      title       TEXT NOT NULL,
      date        TEXT NOT NULL,
      category    TEXT NOT NULL DEFAULT '未分类',
      tags        TEXT NOT NULL DEFAULT '[]',
      description TEXT NOT NULL DEFAULT '',
      cover       TEXT NOT NULL DEFAULT '',
      content     TEXT NOT NULL DEFAULT '',
      published   INTEGER NOT NULL DEFAULT 1,
      is_vip      INTEGER NOT NULL DEFAULT 0,
      views       INTEGER NOT NULL DEFAULT 0,
      created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS plans (
      id        TEXT PRIMARY KEY,
      name      TEXT NOT NULL,
      price     REAL NOT NULL,
      period    TEXT NOT NULL,
      features  TEXT NOT NULL DEFAULT '[]',
      highlight INTEGER NOT NULL DEFAULT 0,
      enabled   INTEGER NOT NULL DEFAULT 1,
      sort      INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS ads (
      id       TEXT PRIMARY KEY,
      title    TEXT NOT NULL,
      image    TEXT NOT NULL DEFAULT '',
      link     TEXT NOT NULL DEFAULT '#',
      position TEXT NOT NULL DEFAULT '侧边栏',
      enabled  INTEGER NOT NULL DEFAULT 1,
      sort     INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS modules (
      id      TEXT PRIMARY KEY,
      type    TEXT NOT NULL,
      label   TEXT NOT NULL,
      value   TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      sort    INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      username   TEXT UNIQUE NOT NULL,
      password   TEXT NOT NULL,
      role       TEXT NOT NULL DEFAULT 'admin'
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token      TEXT PRIMARY KEY,
      user_id    INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    -- 订单：会员购买记录
    CREATE TABLE IF NOT EXISTS orders (
      id         TEXT PRIMARY KEY,
      plan_id    TEXT NOT NULL,
      plan_name  TEXT NOT NULL,
      amount     REAL NOT NULL,
      method     TEXT NOT NULL DEFAULT 'mock',  -- wechat / alipay / mock
      status     TEXT NOT NULL DEFAULT 'pending', -- pending / paid / failed
      contact    TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      paid_at    TEXT
    );
  `);

  migrate(db);
  migratePostDetails(db);
  migrateEditorial(db);
  migrateVideoJobs(db);
  migrateWebImports(db);
  migrateLocalVideos(db);
  migrateCommunity(db);
  migrateFiles(db);
  migrateOrders(db);
  seed(db);
}

// 收费模块：订单表补充对账、退款与操作人字段（兼容旧库）
function migrateOrders(db: Database.Database) {
  const names = (
    db.prepare("PRAGMA table_info(orders)").all() as { name: string }[]
  ).map((c) => c.name);
  const add = (name: string, ddl: string) => {
    if (!names.includes(name))
      db.exec(`ALTER TABLE orders ADD COLUMN ${name} ${ddl}`);
  };
  // 用户填在转账备注里的 6 位付款码，是人工对账的锚点
  add("pay_code", "TEXT NOT NULL DEFAULT ''");
  // 下单的会员账号：确认收款时据此开通，不能靠邮箱猜
  add("member_id", "TEXT NOT NULL DEFAULT ''");
  // 用户点了「我已付款」的时间
  add("submitted_at", "TEXT");
  // 管理员确认收款的时间与操作人
  add("confirmed_at", "TEXT");
  add("operated_by", "TEXT NOT NULL DEFAULT ''");
  // 备注：转账凭证号、退款原因等
  add("order_note", "TEXT NOT NULL DEFAULT ''");
  // 退款
  add("refunded_at", "TEXT");
  add("refund_amount", "REAL");
  // 本单开通后的到期日，退款回滚时用
  add("granted_until", "INTEGER");
}

// 兼容旧数据库：缺失的新列自动补上（不会丢数据）
function migrate(db: Database.Database) {
  const cols = db.prepare("PRAGMA table_info(posts)").all() as {
    name: string;
  }[];
  const names = cols.map((c) => c.name);
  if (!names.includes("is_vip")) {
    db.exec("ALTER TABLE posts ADD COLUMN is_vip INTEGER NOT NULL DEFAULT 0");
  }
  if (!names.includes("views")) {
    db.exec("ALTER TABLE posts ADD COLUMN views INTEGER NOT NULL DEFAULT 0");
  }
}

// 首次运行时写入初始数据
function seed(db: Database.Database) {
  const postCount = db.prepare("SELECT COUNT(*) AS c FROM posts").get() as {
    c: number;
  };
  if (postCount.c === 0) {
    const ins = db.prepare(
      `INSERT INTO posts (slug,title,date,category,tags,description,cover,content,published,is_vip,views)
       VALUES (@slug,@title,@date,@category,@tags,@description,@cover,@content,@published,@is_vip,@views)`,
    );
    const posts = [
      {
        slug: "hello-world",
        title: "第一篇文章：你好，世界",
        date: "2026-10-16",
        category: "随笔",
        tags: JSON.stringify(["开始", "博客"]),
        description: "欢迎来到我的技术博客！介绍一下这个博客以及怎么写新文章。",
        cover:
          "https://images.unsplash.com/photo-1534972195531-d756b9bfa9f2?w=800&q=80",
        content:
          "## 欢迎 👋\n\n这是**阿凡达的技术博客**的第一篇文章。以后我会在这里分享技术教程、折腾笔记和踩坑经验。\n\n## 怎么写新文章？\n\n现在你可以直接在后台写文章了，点「发布」就会保存到数据库并显示在网站上。",
        published: 1,
        is_vip: 0,
        views: 328,
      },
      {
        slug: "deploy-to-synology-nas",
        title: "把博客部署到群晖 NAS（Docker 方式）",
        date: "2026-10-15",
        category: "教程",
        tags: JSON.stringify(["群晖", "Docker", "部署"]),
        description:
          "一步步把这个 Next.js 博客用 Docker 跑在你自己的群晖 NAS 上，大陆访问更稳定。",
        cover:
          "https://images.unsplash.com/photo-1591405351990-4726e331f141?w=800&q=80",
        content:
          "## 为什么用 NAS 部署？\n\n对大陆用户来说，访问更稳定，数据在自己手里。\n\n## 步骤\n\n1. 安装 Container Manager\n2. 构建镜像\n3. 运行容器\n4. 配置外网访问",
        published: 1,
        is_vip: 1,
        views: 1024,
      },
      {
        slug: "markdown-guide",
        title: "Markdown 写作速查表",
        date: "2026-10-14",
        category: "教程",
        tags: JSON.stringify(["Markdown", "写作"]),
        description: "写博客文章常用的 Markdown 语法大全，收藏这一篇就够了。",
        cover:
          "https://images.unsplash.com/photo-1517180102446-f3ece451e9d8?w=800&q=80",
        content:
          "## 标题\n\n用 `##` 表示二级标题。\n\n## 文字\n\n**加粗**、*斜体*、`行内代码`。\n\n## 列表\n\n- 苹果\n- 香蕉",
        published: 1,
        is_vip: 0,
        views: 756,
      },
    ];
    const tx = db.transaction(() => posts.forEach((p) => ins.run(p)));
    tx();
  }

  const planCount = db.prepare("SELECT COUNT(*) AS c FROM plans").get() as {
    c: number;
  };
  if (planCount.c === 0) {
    const ins = db.prepare(
      `INSERT INTO plans (id,name,price,period,features,highlight,enabled,sort)
       VALUES (@id,@name,@price,@period,@features,@highlight,@enabled,@sort)`,
    );
    const plans = [
      {
        id: "plan-month",
        name: "月度会员",
        price: 29,
        period: "/月",
        features: JSON.stringify([
          "全部付费文章",
          "实战视频教程",
          "会员专属下载",
        ]),
        highlight: 0,
        enabled: 1,
        sort: 1,
      },
      {
        id: "plan-year",
        name: "年度会员",
        price: 199,
        period: "/年",
        features: JSON.stringify([
          "月度全部权益",
          "一对一人工咨询",
          "优先答疑",
          "全年持续更新",
        ]),
        highlight: 1,
        enabled: 1,
        sort: 2,
      },
      {
        id: "plan-forever",
        name: "永久会员",
        price: 599,
        period: "永久",
        features: JSON.stringify([
          "年度全部权益",
          "终身免费更新",
          "远程协助服务",
          "专属社群",
        ]),
        highlight: 0,
        enabled: 1,
        sort: 3,
      },
    ];
    db.transaction(() => plans.forEach((p) => ins.run(p)))();
  }

  const adCount = db.prepare("SELECT COUNT(*) AS c FROM ads").get() as {
    c: number;
  };
  if (adCount.c === 0) {
    const ins = db.prepare(
      `INSERT INTO ads (id,title,image,link,position,enabled,sort)
       VALUES (@id,@title,@image,@link,@position,@enabled,@sort)`,
    );
    const ads = [
      {
        id: "ad-vip",
        title: "加入阿凡达 VIP 会员",
        image:
          "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=600&q=80",
        link: "/vip",
        position: "侧边栏",
        enabled: 1,
        sort: 1,
      },
      {
        id: "ad-tool",
        title: "高速下载器 · 立即获取",
        image:
          "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&q=80",
        link: "#",
        position: "侧边栏",
        enabled: 1,
        sort: 2,
      },
    ];
    db.transaction(() => ads.forEach((a) => ins.run(a)))();
  }

  const modCount = db.prepare("SELECT COUNT(*) AS c FROM modules").get() as {
    c: number;
  };
  if (modCount.c === 0) {
    const ins = db.prepare(
      `INSERT INTO modules (id,type,label,value,enabled,sort)
       VALUES (@id,@type,@label,@value,@enabled,@sort)`,
    );
    const mods = [
      {
        id: "nav-1",
        type: "nav",
        label: "首页",
        value: "/",
        enabled: 1,
        sort: 1,
      },
      {
        id: "nav-2",
        type: "nav",
        label: "分类",
        value: "/categories",
        enabled: 1,
        sort: 2,
      },
      {
        id: "nav-3",
        type: "nav",
        label: "教程",
        value: "/categories",
        enabled: 1,
        sort: 3,
      },
      {
        id: "nav-4",
        type: "nav",
        label: "会员",
        value: "/vip",
        enabled: 1,
        sort: 4,
      },
      {
        id: "nav-5",
        type: "nav",
        label: "关于",
        value: "/about",
        enabled: 1,
        sort: 5,
      },
    ];
    db.transaction(() => mods.forEach((m) => ins.run(m)))();
  }

  // 默认管理员账号
  const userCount = db.prepare("SELECT COUNT(*) AS c FROM users").get() as {
    c: number;
  };
  if (userCount.c === 0) {
    const hash = bcrypt.hashSync("avatar2026", 10);
    db.prepare("INSERT INTO users (username,password,role) VALUES (?,?,?)").run(
      "admin",
      hash,
      "admin",
    );
  }

  // 默认站点设置
  const setDefault = db.prepare(
    "INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)",
  );
  setDefault.run("siteName", "阿凡达博客");
  setDefault.run("siteSub", "技术折腾笔记");
  setDefault.run("siteDesc", "分享技术教程、折腾笔记与踩坑经验");
  setDefault.run("primaryColor", "#24a5db");
}
