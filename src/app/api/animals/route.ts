import { requireSessionUser } from "@/lib/auth";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { addAnimal, listAnimals, type Species } from "@/lib/queries";

export async function GET(request: Request) {
  try {
    await requireSessionUser();
    const species = new URL(request.url).searchParams.get("species");
    if (species !== "dog" && species !== "cat") return jsonError("סוג בעל החיים אינו תקין");
    const includeArchived = new URL(request.url).searchParams.get("archived") === "1";
    return jsonOk({ animals: await listAnimals(species as Species, includeArchived) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSessionUser();
    const body = (await request.json()) as { species?: Species; name?: string; chipNumber?: string };
    if (body.species !== "dog" && body.species !== "cat") return jsonError("סוג בעל החיים אינו תקין");
    const animal = await addAnimal(body.species, String(body.name || ""), body.chipNumber);
    return jsonOk({ animal }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
