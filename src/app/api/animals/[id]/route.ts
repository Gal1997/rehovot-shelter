import { requireSessionUser } from "@/lib/auth";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { setAnimalActive, updateAnimal } from "@/lib/queries";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSessionUser();
    const { id } = await params;
    const animalId = Number(id);
    if (!Number.isInteger(animalId)) return jsonError("מזהה אינו תקין");
    const body = (await request.json()) as { name?: string; chipNumber?: string | null; active?: boolean };
    if (typeof body.active === "boolean") {
      return jsonOk({ animal: await setAnimalActive(animalId, body.active) });
    }
    if (body.name === undefined && body.chipNumber === undefined) {
      return jsonError("לא נשלח מה לעדכן");
    }
    const patch: { name?: string; chipNumber?: string | null } = {};
    if (body.name !== undefined) patch.name = String(body.name || "");
    if (body.chipNumber !== undefined) patch.chipNumber = body.chipNumber;
    return jsonOk({ animal: await updateAnimal(animalId, patch) });
  } catch (error) {
    return handleRouteError(error);
  }
}
