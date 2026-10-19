import { cookies } from "next/headers";
import { getDB } from "./db";
import {
  ADMIN_SESSION_SECONDS,
  authenticateAdmin,
  resolveAdminSession,
} from "./admin-auth";
const COOKIE_NAME = "avatar_session";
export async function login(
  username: string,
  password: string,
  secure = false,
): Promise<boolean> {
  const token = authenticateAdmin(getDB(), username, password);
  if (!token) return false;
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: ADMIN_SESSION_SECONDS,
  });
  return true;
}
export async function logout() {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) getDB().prepare("DELETE FROM sessions WHERE token = ?").run(token);
  jar.delete(COOKIE_NAME);
}
export async function currentAdmin() {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  return token ? resolveAdminSession(getDB(), token) : null;
}
export async function isAuthed(): Promise<boolean> {
  return !!(await currentAdmin());
}
