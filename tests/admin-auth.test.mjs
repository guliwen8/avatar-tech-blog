import test from "node:test";
import assert from "node:assert/strict";
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import {
  resolveAdminSession,
  authenticateAdmin,
  replaceAdminPassword,
  ADMIN_SESSION_SECONDS,
} from "../src/server/admin-auth.ts";
function fixture() {
  const db = new Database(":memory:");
  db.exec(
    "CREATE TABLE users(id INTEGER PRIMARY KEY,username TEXT,password TEXT,role TEXT);CREATE TABLE sessions(token TEXT PRIMARY KEY,user_id INTEGER,created_at TEXT DEFAULT (datetime('now')))",
  );
  const hash = bcrypt.hashSync("original-password", 4);
  db.prepare("INSERT INTO users VALUES(?,?,?,?)").run(
    1,
    "operator",
    hash,
    "admin",
  );
  db.prepare("INSERT INTO users VALUES(?,?,?,?)").run(
    2,
    "reader",
    hash,
    "reader",
  );
  return db;
}
test("旧 SQLite UTC 会话七天边界/异常/未来日期失效，角色校验", () => {
  const db = fixture(),
    now = Date.parse("2026-10-18T10:00:00Z");
  const insert = db.prepare("INSERT INTO sessions VALUES(?,?,?)");
  for (const [i, date, valid] of [
    [1, "2026-10-11 10:00:01", true],
    [2, "2026-10-11 10:00:00", false],
    [3, "bad", false],
    [4, "2026-10-19 10:00:00", false],
  ]) {
    const t = String(i).repeat(64);
    insert.run(t, 1, date);
    assert.equal(!!resolveAdminSession(db, t, now), valid);
    if (!valid)
      assert.equal(
        db.prepare("SELECT * FROM sessions WHERE token=?").get(t),
        undefined,
      );
  }
  insert.run("f".repeat(64), 2, "2026-10-18 09:00:00");
  assert.equal(resolveAdminSession(db, "f".repeat(64), now), null);
  assert.equal(ADMIN_SESSION_SECONDS, 604800);
  db.close();
});
test("改密码只修改当前管理员并撤销其全部会话，弱密码拒绝，旧密码失效", () => {
  const db = fixture();
  const a = authenticateAdmin(db, "operator", "original-password");
  const b = authenticateAdmin(db, "operator", "original-password");
  assert.ok(a && b);
  assert.equal(authenticateAdmin(db, "reader", "original-password"), null);
  assert.throws(() => replaceAdminPassword(db, 1, "short"));
  assert.ok(resolveAdminSession(db, a));
  replaceAdminPassword(db, 1, "replacement-password");
  assert.equal(resolveAdminSession(db, a), null);
  assert.equal(resolveAdminSession(db, b), null);
  assert.equal(authenticateAdmin(db, "operator", "original-password"), null);
  assert.ok(authenticateAdmin(db, "operator", "replacement-password"));
  assert.throws(() => replaceAdminPassword(db, 1, "长".repeat(25)));
  db.close();
});
