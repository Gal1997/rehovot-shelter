import { requireSessionUser } from "@/lib/auth";
import { handleRouteError, jsonError, jsonOk, readMedications } from "@/lib/api";
import { isPastOrToday, normalizedMedications } from "@/lib/validation";
import { closeReport, deleteOpenReport, updateReport } from "@/lib/queries";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireSessionUser();
    const id = Number((await params).id);
    const body = (await request.json()) as {
      reporterUserId?: number;
      reporterName?: string;
      symptomId?: number;
      reportDate?: string;
      notes?: string;
      medications?: unknown;
      expectedUpdatedAt?: string;
    };
    if (!Number.isInteger(id) || !Number.isInteger(Number(body.symptomId)) || Number(body.symptomId) < 1 || !body.expectedUpdatedAt) {
      return jsonError("פרטי הדיווח אינם תקינים");
    }
    if (!isPastOrToday(String(body.reportDate || ""))) {
      return jsonError("תאריך הדיווח חייב להיות תקין, לפי שעון ישראל, ולא עתידי");
    }
    const medications = normalizedMedications(readMedications(body.medications));
    const notes = String(body.notes || "").trim();
    if (notes.length > 10000) return jsonError("ההערות יכולות להכיל עד 10,000 תווים");
    const report = await updateReport({
      id,
      reporterUserId: Number(body.reporterUserId || user.id),
      reporterName: String(body.reporterName || user.displayName).trim() || user.displayName,
      symptomId: Number(body.symptomId),
      reportDate: String(body.reportDate),
      notes,
      medications,
      expectedUpdatedAt: String(body.expectedUpdatedAt),
    });
    return jsonOk({ report });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSessionUser();
    const id = Number((await params).id);
    const body = (await request.json()) as { action?: string };
    if (!Number.isInteger(id) || body.action !== "close") return jsonError("פעולה לא תקינה");
    return jsonOk({ report: await closeReport(id) });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSessionUser();
    const id = Number((await params).id);
    if (!Number.isInteger(id)) return jsonError("דיווח לא תקין");
    await deleteOpenReport(id);
    return jsonOk({ ok: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
