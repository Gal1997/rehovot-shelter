import { requireSessionUser } from "@/lib/auth";
import { handleRouteError, jsonOk } from "@/lib/api";

export async function GET() {
  try {
    const user = await requireSessionUser();
    return jsonOk({ user });
  } catch (error) {
    return handleRouteError(error);
  }
}
