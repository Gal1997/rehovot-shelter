import { requireSessionUser } from "@/lib/auth";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { listNamedItems, upsertNamedItem } from "@/lib/queries";

export async function GET() {
  try {
    await requireSessionUser();
    const [symptoms, medications, vaccines] = await Promise.all([
      listNamedItems("symptoms"),
      listNamedItems("medications"),
      listNamedItems("vaccines"),
    ]);
    return jsonOk({ symptoms, medications, vaccines });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSessionUser();
    const body = (await request.json()) as {
      kind?: "symptoms" | "medications" | "vaccines";
      action?: "add" | "update" | "remove";
      id?: number;
      name?: string;
    };
    if (!body.kind || !body.action) return jsonError("פעולה לא תקינה");
    await upsertNamedItem(body.kind, body.action, { id: body.id, name: body.name });
    const [symptoms, medications, vaccines] = await Promise.all([
      listNamedItems("symptoms"),
      listNamedItems("medications"),
      listNamedItems("vaccines"),
    ]);
    return jsonOk({ symptoms, medications, vaccines });
  } catch (error) {
    return handleRouteError(error);
  }
}
