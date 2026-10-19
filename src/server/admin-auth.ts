import type Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
export const ADMIN_SESSION_SECONDS = 7 * 86400;
export function resolveAdminSession(
  db: Database.Database,
  token: string,
  now = Date.now(),
) {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const row = db
    .prepare(
      `SELECT users.id, users.username, sessions.created_at FROM sessions JOIN users ON users.id=sessions.user_id WHERE sessions.token=? AND users.role='admin'`,
    )
    .get(token) as
    { id: number; username: string; created_at: string } | undefined;
  if (!row) return null;
  // Legacy SQLite timestamps have no timezone; they are UTC.
  const raw = row.created_at;
  const created = Date.parse(
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(raw)
      ? raw.replace(" ", "T") + "Z"
      : raw,
  );
  if (
    !Number.isFinite(created) ||
    created > now ||
    now - created >= ADMIN_SESSION_SECONDS * 1000
  ) {
    db.prepare("DELETE FROM sessions WHERE token=?").run(token);
    return null;
  }
  return { id: row.id, username: row.username };
}
export function authenticateAdmin(
  db: Database.Database,
  username: string,
  password: string,
) {
  const user = db
    .prepare("SELECT id,password FROM users WHERE username=? AND role='admin'")
    .get(username) as { id: number; password: string } | undefined;
  if (!user || !bcrypt.compareSync(password, user.password)) return null;
  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions(token,user_id) VALUES(?,?)").run(
    token,
    user.id,
  );
  return token;
}
export function replaceAdminPassword(
  db: Database.Database,
  userId: number,
  password: unknown,
) {
  if (
    typeof password !== "string" ||
    password.length < 10 ||
    Buffer.byteLength(password) > 72
  )
    throw new Error("密码至少 10 位，且不能超过 72 字节");
  const hash = bcrypt.hashSync(password, 10);
  db.transaction(() => {
    const changed = db
      .prepare("UPDATE users SET password=? WHERE id=? AND role='admin'")
      .run(hash, userId);
    if (!changed.changes) throw new Error("管理员不存在");
    db.prepare("DELETE FROM sessions WHERE user_id=?").run(userId);
  })();
}
