import bcrypt from "bcryptjs";
import crypto from "crypto";
import { cookies } from "next/headers";
import { getDB } from "./db";

const COOKIE_NAME = "avatar_session";

// 校验用户名密码，成功则创建会话并写 Cookie
export async function login(
  username: string,
  password: string
): Promise<boolean> {
  const db = getDB();
  const user = db
    .prepare("SELECT * FROM users WHERE username = ?")
    .get(username) as { id: number; password: string } | undefined;
  if (!user) return false;
  if (!bcrypt.compareSync(password, user.password)) return false;

  const token = crypto.randomBytes(32).toString("hex");
  db.prepare("INSERT INTO sessions (token, user_id) VALUES (?, ?)").run(
    token,
    user.id
  );

  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 天
  });
  return true;
}

// 退出登录
export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    getDB().prepare("DELETE FROM sessions WHERE token = ?").run(token);
    jar.delete(COOKIE_NAME);
  }
}

// 当前请求是否已登录（服务端校验）
export async function isAuthed(): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return false;
  const row = getDB()
    .prepare("SELECT token FROM sessions WHERE token = ?")
    .get(token);
  return !!row;
}

// 修改管理员密码
export function changePassword(username: string, newPassword: string) {
  const hash = bcrypt.hashSync(newPassword, 10);
  getDB()
    .prepare("UPDATE users SET password = ? WHERE username = ?")
    .run(hash, username);
}
