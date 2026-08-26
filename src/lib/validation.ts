import { isIsoDate, todayInIsrael } from "./dates";
import type { Medication } from "./types";

export const EARLIEST_DATE = "2018-01-01";

export function normalizeChipNumber(value: unknown): string | null {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

export function yearsAhead(years: number): string {
  const [year, month, day] = todayInIsrael().split("-").map(Number);
  const date = new Date(Date.UTC(year + years, month - 1, day));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isPastOrToday(value: string): boolean {
  return isIsoDate(value) && value >= EARLIEST_DATE && value <= todayInIsrael();
}

export function isTodayOrFuture(value: string): boolean {
  return isIsoDate(value) && value >= todayInIsrael() && value <= yearsAhead(2);
}

export function isValidDateRange(from: string, to: string): boolean {
  if (from && !isIsoDate(from)) return false;
  if (to && !isIsoDate(to)) return false;
  if (from && to && from > to) return false;
  return true;
}

export function filledMedications(medications: Medication[]) {
  return medications.filter(
    (med) => String(med.name || "").trim() || med.treatmentDate || med.durationDays || med.frequencyPerDay,
  );
}

export function medicationError(medications: Medication[]): string | null {
  const filled = filledMedications(medications);
  if (filled.length > 20) return "ניתן להוסיף עד 20 תרופות לדיווח";
  for (const med of filled) {
    const name = String(med.name || "").trim();
    if (!name) return "חסר שם תרופה באחד הטיפולים";
    if (name.length > 100) return `שם התרופה “${name}” ארוך מדי`;
    if (!isPastOrToday(String(med.treatmentDate || ""))) {
      return `תאריך הטיפול ב“${name}” חייב להיות תקין, לא עתידי, ולא לפני 2018`;
    }
    const duration = Number(med.durationDays);
    if (!Number.isInteger(duration) || duration < 1 || duration > 365) {
      return `משך הטיפול ב“${name}” חייב להיות מספר שלם בין 1 ל־365 ימים`;
    }
    const frequency = Number(med.frequencyPerDay);
    if (!Number.isInteger(frequency) || frequency < 1 || frequency > 24) {
      return `התדירות ב“${name}” חייבת להיות בין 1 ל־24 פעמים ביום`;
    }
  }
  return null;
}

export function normalizedMedications(medications: Medication[]) {
  const error = medicationError(medications);
  if (error) throw new Error(error);
  return filledMedications(medications).map((med) => ({
    name: String(med.name).trim(),
    treatmentDate: String(med.treatmentDate),
    durationDays: Number(med.durationDays),
    frequencyPerDay: Number(med.frequencyPerDay),
  }));
}
