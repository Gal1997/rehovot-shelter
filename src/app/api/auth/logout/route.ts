import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";
import { jsonOk } from "@/lib/api";

export async function POST() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  return jsonOk({ ok: true });
}
