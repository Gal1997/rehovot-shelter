import { requireSessionUser } from "@/lib/auth";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { bootstrap, type Species } from "@/lib/queries";

export async function GET(request: Request) {
  try {
    const user = await requireSessionUser();
    const species = new URL(request.url).searchParams.get("species");
    if (species !== "dog" && species !== "cat") return jsonError("סוג בעל החיים אינו תקין");
    const data = await bootstrap(species as Species);
    return jsonOk({ user, ...data });
  } catch (error) {
    return handleRouteError(error);
  }
}
