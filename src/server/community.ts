import type Database from "better-sqlite3";
import crypto from "node:crypto";
import bcrypt from "bcryptjs";
export interface Member {
  id: string;
  username: string;
  email: string;
  memberUntil: number;
  createdAt: number;
}
export interface Ticket {
  id: string;
  member_id: string;
  subject: string;
  body: string;
  status: "open" | "replied" | "closed";
  created_at: number;
  updated_at: number;
  username?: string;
}
interface Message {
  id: string;
  ticket_id: string;
  role: "admin" | "member";
  body: string;
  created_at: number;
}
export function migrateCommunity(db: Database.Database) {
  db.exec(`CREATE TABLE IF NOT EXISTS members(id TEXT PRIMARY KEY,username TEXT NOT NULL UNIQUE COLLATE NOCASE,email TEXT NOT NULL UNIQUE COLLATE NOCASE,password_hash TEXT NOT NULL,member_until INTEGER NOT NULL DEFAULT 0,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS member_sessions(token_hash TEXT PRIMARY KEY,member_id TEXT NOT NULL,expires_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS member_session_expiry ON member_sessions(expires_at);
 CREATE TABLE IF NOT EXISTS member_limits(key TEXT PRIMARY KEY,window_start INTEGER NOT NULL,count INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS consultations(id TEXT PRIMARY KEY,member_id TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS consultations_owner ON consultations(member_id,updated_at);
 CREATE TABLE IF NOT EXISTS consultation_messages(id TEXT PRIMARY KEY,ticket_id TEXT NOT NULL,role TEXT NOT NULL,body TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS consultation_message_ticket ON consultation_messages(ticket_id,created_at);`);
}
function toMember(r: any): Member {
  return {
    id: r.id,
    username: r.username,
    email: r.email,
    memberUntil: r.member_until,
    createdAt: r.created_at,
  };
}
function text(raw: unknown, max: number, label: string) {
  if (typeof raw !== "string" || !raw.trim() || raw.trim().length > max)
    throw new Error(`${label}不能为空且不能超过 ${max} 字`);
  return raw.trim();
}
export function registerMember(
  db: Database.Database,
  input: { username: unknown; email: unknown; password: unknown },
): Member {
  const username = text(input.username, 30, "用户名").normalize("NFKC");
  if (!/^[\p{L}\p{N}_-]{2,30}$/u.test(username))
    throw new Error("用户名需为 2–30 位文字、数字、下划线或连字符");
  const email = text(input.email, 254, "邮箱").toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new Error("邮箱格式不正确");
  if (
    typeof input.password !== "string" ||
    input.password.length < 10 ||
    Buffer.byteLength(input.password) > 72
  )
    throw new Error("密码至少 10 位，且不能超过 72 字节");
  const id = crypto.randomUUID(),
    now = Date.now();
  const hash = bcrypt.hashSync(input.password, 10);
  try {
    db.prepare(
      "INSERT INTO members(id,username,email,password_hash,created_at) VALUES(?,?,?,?,?)",
    ).run(id, username, email, hash, now);
  } catch (e) {
    if ((e as { code?: string }).code?.startsWith("SQLITE_CONSTRAINT"))
      throw new Error("账号无法创建，请更换用户名或邮箱");
    throw e;
  }
  return { id, username, email, memberUntil: 0, createdAt: now };
}
const dummyHash = bcrypt.hashSync("invalid-login-placeholder", 10);
export function authenticateMember(
  db: Database.Database,
  login: unknown,
  password: unknown,
): Member | null {
  if (
    typeof login !== "string" ||
    typeof password !== "string" ||
    login.length > 254 ||
    Buffer.byteLength(password) > 72
  )
    return null;
  const row = db
    .prepare(
      "SELECT * FROM members WHERE username=? COLLATE NOCASE OR email=? COLLATE NOCASE",
    )
    .get(login.trim().normalize("NFKC"), login.trim().toLowerCase()) as any;
  const valid = bcrypt.compareSync(password, row?.password_hash || dummyHash);
  return row && valid ? toMember(row) : null;
}
const digest = (token: string) =>
  crypto.createHash("sha256").update(token).digest("hex");
export function createMemberSession(
  db: Database.Database,
  memberId: string,
  now = Date.now(),
) {
  const token = crypto.randomBytes(32).toString("hex"),
    expiresAt = now + 7 * 24 * 60 * 60 * 1000;
  db.prepare("DELETE FROM member_sessions WHERE expires_at<=?").run(now);
  db.prepare(
    "INSERT INTO member_sessions(token_hash,member_id,expires_at) VALUES(?,?,?)",
  ).run(digest(token), memberId, expiresAt);
  return { token, expiresAt };
}
export function resolveMemberSession(
  db: Database.Database,
  token: string,
  now = Date.now(),
): Member | null {
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const row = db
    .prepare(
      "SELECT m.* FROM members m JOIN member_sessions s ON s.member_id=m.id WHERE s.token_hash=? AND s.expires_at>?",
    )
    .get(digest(token), now);
  return row ? toMember(row) : null;
}
export function revokeMemberSession(db: Database.Database, token: string) {
  db.prepare("DELETE FROM member_sessions WHERE token_hash=?").run(
    digest(token),
  );
}
export function listMembers(db: Database.Database): Member[] {
  return (
    db
      .prepare("SELECT * FROM members ORDER BY created_at DESC LIMIT 200")
      .all() as any[]
  ).map(toMember);
}
export function grantMembership(
  db: Database.Database,
  id: string,
  until: number,
) {
  if (
    !Number.isSafeInteger(until) ||
    until < 0 ||
    until > Date.now() + 10 * 366 * 86400000
  )
    throw new Error("会员到期时间无效");
  const r = db
    .prepare("UPDATE members SET member_until=? WHERE id=?")
    .run(until, id);
  if (!r.changes) throw new Error("账号不存在");
}
export function setMemberPassword(
  db: Database.Database,
  id: string,
  password: unknown,
) {
  if (
    typeof password !== "string" ||
    password.length < 10 ||
    Buffer.byteLength(password) > 72
  )
    throw new Error("密码至少 10 位且不能超过 72 字节");
  const hash = bcrypt.hashSync(password, 10);
  db.transaction(() => {
    if (
      !db.prepare("UPDATE members SET password_hash=? WHERE id=?").run(hash, id)
        .changes
    )
      throw new Error("账号不存在");
    db.prepare("DELETE FROM member_sessions WHERE member_id=?").run(id);
  })();
}
export function rateLimit(
  db: Database.Database,
  key: string,
  max: number,
  windowMs: number,
  now = Date.now(),
): boolean {
  return db
    .transaction(() => {
      db.prepare("DELETE FROM member_limits WHERE window_start<?").run(
        now - 86400000,
      );
      const r = db
        .prepare("SELECT * FROM member_limits WHERE key=?")
        .get(key) as { window_start: number; count: number } | undefined;
      if (!r || now - r.window_start >= windowMs) {
        db.prepare(
          "INSERT OR REPLACE INTO member_limits(key,window_start,count) VALUES(?,?,1)",
        ).run(key, now);
        return true;
      }
      if (r.count >= max) return false;
      db.prepare("UPDATE member_limits SET count=count+1 WHERE key=?").run(key);
      return true;
    })
    .immediate();
}
export function createTicket(
  db: Database.Database,
  memberId: string,
  input: { subject: unknown; body: unknown },
): Ticket {
  const subject = text(input.subject, 120, "问题标题"),
    body = text(input.body, 12000, "问题详情");
  const now = Date.now(),
    id = crypto.randomUUID();
  db.prepare(
    "INSERT INTO consultations(id,member_id,subject,body,created_at,updated_at) VALUES(?,?,?,?,?,?)",
  ).run(id, memberId, subject, body, now, now);
  return {
    id,
    member_id: memberId,
    subject,
    body,
    status: "open",
    created_at: now,
    updated_at: now,
  };
}
export function listMemberTickets(
  db: Database.Database,
  memberId: string,
): Ticket[] {
  return db
    .prepare(
      "SELECT * FROM consultations WHERE member_id=? ORDER BY updated_at DESC LIMIT 50",
    )
    .all(memberId) as Ticket[];
}
export function listAllTickets(db: Database.Database): Ticket[] {
  return db
    .prepare(
      "SELECT c.*,m.username FROM consultations c JOIN members m ON m.id=c.member_id ORDER BY c.updated_at DESC LIMIT 100",
    )
    .all() as Ticket[];
}
export function getTicket(
  db: Database.Database,
  id: string,
  memberId?: string,
): (Ticket & { messages: Message[] }) | null {
  const ticket = (
    memberId
      ? db
          .prepare("SELECT * FROM consultations WHERE id=? AND member_id=?")
          .get(id, memberId)
      : db.prepare("SELECT * FROM consultations WHERE id=?").get(id)
  ) as Ticket | undefined;
  return ticket
    ? {
        ...ticket,
        messages: db
          .prepare(
            "SELECT * FROM consultation_messages WHERE ticket_id=? ORDER BY created_at,rowid",
          )
          .all(id) as Message[],
      }
    : null;
}
export function replyTicket(
  db: Database.Database,
  id: string,
  role: "admin" | "member",
  memberId: string | null,
  body: unknown,
) {
  const content = text(body, 12000, "回复");
  return db.transaction(() => {
    const t = getTicket(
      db,
      id,
      role === "member" ? memberId || "invalid" : undefined,
    );
    if (!t) throw new Error("咨询不存在");
    if (t.status === "closed") throw new Error("该咨询已关闭");
    const now = Date.now();
    db.prepare(
      "INSERT INTO consultation_messages(id,ticket_id,role,body,created_at) VALUES(?,?,?,?,?)",
    ).run(crypto.randomUUID(), id, role, content, now);
    db.prepare("UPDATE consultations SET status=?,updated_at=? WHERE id=?").run(
      role === "admin" ? "replied" : "open",
      now,
      id,
    );
  })();
}
