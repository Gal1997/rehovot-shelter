import { requireSessionUser } from "@/lib/auth";
import { handleRouteError, jsonError, jsonOk, readMedications } from "@/lib/api";
import { isPastOrToday, normalizedMedications } from "@/lib/validation";
import { createReport, getAnimalReports } from "@/lib/queries";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSessionUser();
    const { id } = await params;
    const animalId = Number(id);
    const page = Number(new URL(request.url).searchParams.get("page") || 1);
    if (!Number.isInteger(animalId)) return jsonError("מזהה אינו תקין");
    return jsonOk(await getAnimalReports(animalId, Math.max(1, page)));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const { id } = await params;
    const animalId = Number(id);
    const body = (await request.json()) as {
      reporterUserId?: number;
      reporterName?: string;
      symptomId?: number;
      reportDate?: string;
      notes?: string;
      medications?: unknown;
    };
    if (!Number.isInteger(animalId) || !Number.isInteger(Number(body.symptomId)) || Number(body.symptomId) < 1) {
      return jsonError("יש לבחור תסמין תקין");
    }
    if (!isPastOrToday(String(body.reportDate || ""))) {
      return jsonError("תאריך הדיווח חייב להיות תקין, לפי שעון ישראל, ולא עתידי");
    }
    const medications = normalizedMedications(readMedications(body.medications));
    const notes = String(body.notes || "").trim();
    if (notes.length > 10000) return jsonError("ההערות יכולות להכיל עד 10,000 תווים");
    const report = await createReport({
      animalId,
      reporterUserId: Number(body.reporterUserId || user.id),
      reporterName: String(body.reporterName || user.displayName).trim() || user.displayName,
      symptomId: Number(body.symptomId),
      reportDate: String(body.reportDate),
      notes,
      medications,
    });
    return jsonOk({ report }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
