import { cookies } from "next/headers";
import { cookieOptions, createSessionToken, SESSION_COOKIE, verifyPassword } from "@/lib/auth";
import { jsonError, jsonOk } from "@/lib/api";
import { findUserByUsername } from "@/lib/queries";

export async function POST(request: Request) {
  let body: { username?: string; password?: string };
  try {
    body = (await request.json()) as { username?: string; password?: string };
  } catch {
    return jsonError("בקשת ההתחברות אינה תקינה");
  }
  const username = String(body.username || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (!username || !password) return jsonError("יש להזין שם משתמש וסיסמה");

  const user = await findUserByUsername(username);
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    return jsonError("שם המשתמש או הסיסמה שגויים", 401);
  }

  const token = await createSessionToken({
    id: user.id,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, cookieOptions());
  return jsonOk({
    user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role },
  });
}
