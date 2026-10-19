import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import {
  migrateCommunity,
  registerMember,
  authenticateMember,
  createMemberSession,
  resolveMemberSession,
  grantMembership,
  createTicket,
  listMemberTickets,
  replyTicket,
  getTicket,
  revokeMemberSession,
  rateLimit,
} from "../src/server/community.ts";
import { canRead, redactDetails, safeReturnPath } from "../src/lib/access.ts";
function fixture() {
  const db = new Database(":memory:");
  migrateCommunity(db);
  migrateCommunity(db);
  return db;
}
test("独立账号不产生管理员；密码及会话不以明文保存；到期/撤销立即失效", () => {
  const db = fixture();
  const m = registerMember(db, {
    username: "读者甲",
    email: "a@example.com",
    password: "a-long-password-123",
  });
  assert.equal(
    db.prepare("SELECT count(*) n FROM sqlite_master WHERE name='users'").get()
      .n,
    0,
  );
  assert.notEqual(
    db.prepare("SELECT password_hash FROM members").get().password_hash,
    "a-long-password-123",
  );
  assert.ok(authenticateMember(db, "A@example.com", "a-long-password-123"));
  assert.equal(authenticateMember(db, "读者甲", "wrong"), null);
  const s = createMemberSession(db, m.id, 1000);
  assert.notEqual(
    db.prepare("SELECT token_hash FROM member_sessions").get().token_hash,
    s.token,
  );
  assert.equal(resolveMemberSession(db, s.token, 1001).id, m.id);
  assert.equal(resolveMemberSession(db, s.token, s.expiresAt), null);
  revokeMemberSession(db, s.token);
  assert.equal(resolveMemberSession(db, s.token, 1002), null);
  db.close();
});
test("权限分开处理公开、登录、有效/到期会员；元数据剔除受限链接", () => {
  const now = 1000;
  assert.equal(canRead("public", null, now), true);
  assert.equal(canRead("login", null, now), false);
  assert.equal(canRead("login", { memberUntil: 0 }, now), true);
  assert.equal(canRead("member", { memberUntil: 1001 }, now), true);
  assert.equal(canRead("member", { memberUntil: 1000 }, now), false);
  assert.deepEqual(
    redactDetails({
      kind: "video",
      access: "member",
      videoUrl: "https://private.example.com/a.mp4",
      sourceUrl: "https://private.example.com",
      duration: "1:00",
    }),
    { kind: "video", access: "member", duration: "1:00" },
  );
});
test("不能自己领取会员；后台设置有效期后实时读取", () => {
  const db = fixture(),
    m = registerMember(db, {
      username: "reader",
      email: "r@example.com",
      password: "a-long-password-123",
    });
  assert.equal(m.memberUntil, 0);
  grantMembership(db, m.id, 5000);
  const s = createMemberSession(db, m.id, 1000);
  assert.equal(resolveMemberSession(db, s.token, 1001).memberUntil, 5000);
  grantMembership(db, m.id, 0);
  assert.equal(resolveMemberSession(db, s.token, 1001).memberUntil, 0);
  db.close();
});
test("咨询按所有者隔离，回复持久化，关闭后不能继续回复", () => {
  const db = fixture();
  const a = registerMember(db, {
      username: "读者甲",
      email: "a@example.com",
      password: "a-long-password-123",
    }),
    b = registerMember(db, {
      username: "读者乙",
      email: "b@example.com",
      password: "a-long-password-123",
    });
  const t = createTicket(db, a.id, {
    subject: "部署问题",
    body: "环境和错误详情",
  });
  assert.equal(listMemberTickets(db, b.id).length, 0);
  assert.equal(getTicket(db, t.id, b.id), null);
  assert.throws(() => replyTicket(db, t.id, "member", b.id, "不能越权"));
  replyTicket(db, t.id, "admin", null, "请检查端口映射");
  assert.equal(getTicket(db, t.id, a.id).status, "replied");
  assert.equal(getTicket(db, t.id, a.id).messages.length, 1);
  replyTicket(db, t.id, "member", a.id, "已检查");
  assert.equal(getTicket(db, t.id, a.id).status, "open");
  db.prepare("UPDATE consultations SET status='closed' WHERE id=?").run(t.id);
  assert.throws(() => replyTicket(db, t.id, "member", a.id, "继续"));
  db.close();
});

test("新表迁移不触碰原管理员、会话、文章或订单", () => {
  const db = new Database(":memory:");
  db.exec(
    "CREATE TABLE users(id INTEGER,role TEXT); INSERT INTO users VALUES(1,'admin'); CREATE TABLE sessions(token TEXT); INSERT INTO sessions VALUES('legacy'); CREATE TABLE posts(slug TEXT,views INTEGER); INSERT INTO posts VALUES('old',77); CREATE TABLE orders(id TEXT); INSERT INTO orders VALUES('paid');",
  );
  migrateCommunity(db);
  migrateCommunity(db);
  assert.equal(db.prepare("SELECT views FROM posts").get().views, 77);
  assert.equal(db.prepare("SELECT token FROM sessions").get().token, "legacy");
  assert.equal(db.prepare("SELECT role FROM users").get().role, "admin");
  assert.equal(db.prepare("SELECT id FROM orders").get().id, "paid");
  db.close();
});

test("频率限制存入数据库，返回路径不能跳站外或管理员/登录循环", () => {
  const db = fixture();
  assert.equal(rateLimit(db, "test", 2, 1000, 1000), true);
  assert.equal(rateLimit(db, "test", 2, 1000, 1100), true);
  assert.equal(rateLimit(db, "test", 2, 1000, 1200), false);
  assert.equal(rateLimit(db, "test", 2, 1000, 2000), true);
  db.close();
  for (const path of [
    "https://evil.example",
    "//evil.example",
    "/admin",
    "/login",
    "/register?redirect=/login",
    "/\\evil.example",
  ])
    assert.equal(safeReturnPath(path), "/account");
  assert.equal(safeReturnPath("/posts/hello-world"), "/posts/hello-world");
});
