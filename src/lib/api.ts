import { NextResponse } from "next/server";
import { AuthError } from "./auth";

export function jsonError(message: string, status = 400, extra?: Record<string, unknown>) {
  return NextResponse.json({ error: message, ...extra }, { status, headers: { "cache-control": "no-store" } });
}

export function jsonOk(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: { "cache-control": "no-store" } });
}

export function handleRouteError(error: unknown) {
  if (error instanceof AuthError) return jsonError(error.message, error.status);
  if (error instanceof Error) {
    const status = "status" in error && typeof error.status === "number" ? error.status : 400;
    const extra =
      "existingReportId" in error && typeof error.existingReportId === "number"
        ? { existingReportId: error.existingReportId }
        : undefined;
    return jsonError(error.message || "הפעולה נכשלה", status, extra);
  }
  return jsonError("הפעולה נכשלה", 500);
}

export function readMedications(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => ({
    name: String(item?.name || "").trim(),
    treatmentDate: String(item?.treatmentDate || item?.date || "").trim(),
    durationDays: item?.durationDays === "" || item?.durationDays == null ? "" : Number(item.durationDays),
    frequencyPerDay: item?.frequencyPerDay === "" || item?.frequencyPerDay == null ? "" : Number(item.frequencyPerDay),
  }));
}
