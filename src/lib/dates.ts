const TIME_ZONE = "Asia/Jerusalem";

export function todayInIsrael(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

export function isNotFutureDate(value: string): boolean {
  return isIsoDate(value) && value <= todayInIsrael();
}


export function formatDateHe(value: string): string {
  if (!isIsoDate(value)) return value || "—";
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

export function formatTodayHe(): string {
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

export function daysSince(isoDate: string): number | null {
  if (!isIsoDate(isoDate)) return null;
  const today = todayInIsrael();
  const start = Date.parse(`${isoDate}T00:00:00+03:00`);
  const end = Date.parse(`${today}T00:00:00+03:00`);
  if (Number.isNaN(start) || Number.isNaN(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

export function inclusiveDays(isoDate: string): number | null {
  const elapsed = daysSince(isoDate);
  if (elapsed === null) return null;
  return elapsed + 1;
}

export function remainingTreatmentDays(treatmentDate: string, durationDays: number): number | null {
  const elapsed = daysSince(treatmentDate);
  if (elapsed === null) return null;
  return durationDays - elapsed;
}

export function treatmentEndDate(treatmentDate: string, durationDays: number): string {
  if (!isIsoDate(treatmentDate) || durationDays < 1) return "—";
  const [year, month, day] = treatmentDate.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + durationDays - 1));
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
