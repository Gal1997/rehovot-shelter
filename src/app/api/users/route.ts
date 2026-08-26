import { hashPassword, requireAdmin } from "@/lib/auth";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { createUser, listStaff, updateUser } from "@/lib/queries";

export async function GET() {
  try {
    await requireAdmin();
    return jsonOk({ users: await listStaff() });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
    const body = (await request.json()) as {
      username?: string;
      password?: string;
      displayName?: string;
      role?: "admin" | "staff";
    };
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    const displayName = String(body.displayName || "").trim();
    const role = body.role === "admin" ? "admin" : "staff";
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) return jsonError("שם המשתמש חייב להיות באנגלית, 3–32 תווים");
    if (password.length < 6) return jsonError("הסיסמה חייבת להכיל לפחות 6 תווים");
    if (!displayName || displayName.length > 40) return jsonError("יש להזין שם תצוגה");
    const user = await createUser({
      username,
      passwordHash: await hashPassword(password),
      displayName,
      role,
    });
    return jsonOk({
      user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role, active: user.active },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const admin = await requireAdmin();
    const body = (await request.json()) as {
      id?: number;
      displayName?: string;
      role?: "admin" | "staff";
      active?: boolean;
      password?: string;
    };
    if (!Number.isInteger(Number(body.id))) return jsonError("חסר מזהה משתמש");
    if (Number(body.id) === admin.id && body.active === false) {
      return jsonError("אי אפשר להשבית את המשתמש שמחובר כעת");
    }
    if (body.password && body.password.length < 6) return jsonError("הסיסמה חייבת להכיל לפחות 6 תווים");
    const user = await updateUser(Number(body.id), {
      displayName: body.displayName,
      role: body.role,
      active: body.active,
      passwordHash: body.password ? await hashPassword(body.password) : undefined,
    });
    if (!user) return jsonError("המשתמש לא נמצא", 404);
    return jsonOk({
      user: { id: user.id, username: user.username, displayName: user.displayName, role: user.role, active: user.active },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
