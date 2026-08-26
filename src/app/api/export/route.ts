import { requireSessionUser } from "@/lib/auth";
import { handleRouteError, jsonError } from "@/lib/api";
import { isIsoDate, todayInIsrael } from "@/lib/dates";
import { buildWorkbook, dateCell } from "@/lib/excel";
import { exportRows, type Species } from "@/lib/queries";

export async function GET(request: Request) {
  try {
    await requireSessionUser();
    const url = new URL(request.url);
    const kind = url.searchParams.get("kind") || "all";
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    const species = url.searchParams.get("species") as Species | null;
    const animalId = Number(url.searchParams.get("animalId") || 0);
    const recordType = (url.searchParams.get("recordType") || "reports") as
      | "reports"
      | "medications"
      | "vaccinations";
    const activeOnly = url.searchParams.get("activeOnly") === "1";
    const vaccinationStatus = (url.searchParams.get("vaccinationStatus") || "all") as
      | "all"
      | "completed"
      | "planned";

    if (!["all", "dogs", "cats", "animal", "vaccinations"].includes(kind)) {
      return jsonError("פרטי הייצוא אינם תקינים");
    }
    if ((from && !isIsoDate(from)) || (to && !isIsoDate(to))) return jsonError("תאריכי הייצוא אינם תקינים");
    if (from && to && from > to) return jsonError("תאריך ההתחלה לא יכול להיות אחרי תאריך הסיום");
    if (kind === "animal" && (!Number.isInteger(animalId) || animalId < 1)) return jsonError("יש לבחור בעל חיים");

    const data = await exportRows({
      kind: kind as "all" | "dogs" | "cats" | "animal" | "vaccinations",
      species: species === "dog" || species === "cat" ? species : undefined,
      animalId: animalId || undefined,
      from: from || undefined,
      to: to || undefined,
      recordType,
      activeOnly,
      vaccinationStatus,
    });

    const reportHeaders = ["מספר", "סוג", "שם בעל החיים", "מס׳ שבב", "שם העובד", "תסמין", "תאריך דיווח", "מצב", "הערות"];
    const reportRows = data.reportRows.map((row) => [
      row.id,
      row.species === "dog" ? "כלב" : "חתול",
      row.animalName,
      row.chipNumber || "",
      row.reporter,
      row.issue,
      dateCell(row.reportDate),
      row.closedAt ? "סגור" : "פעיל",
      row.notes,
    ]);
    const medMap = new Map(data.reportRows.map((row) => [row.id, row]));
    const medicationRows = data.meds.map((med) => {
      const report = medMap.get(med.reportId);
      return [
        report?.species === "dog" ? "כלב" : "חתול",
        report?.animalName || "",
        report?.chipNumber || "",
        report?.reporter || "",
        med.name,
        dateCell(med.treatmentDate),
        med.durationDays,
        med.frequencyPerDay,
        dateCell(report?.reportDate),
      ];
    });
    const vaccineRows = data.vaccineRows.map((row) => [
      row.animalSpecies === "dog" ? "כלב" : "חתול",
      row.animalName,
      row.vaccineName,
      dateCell(row.dueDate),
      row.status === "completed" ? "בוצע" : "מתוכנן",
      dateCell(row.completedDate),
    ]);

    const sheets = [
      {
        name: "סיכום",
        headers: ["מדד", "ערך"],
        rows: [
          ["נוצר בתאריך", todayInIsrael()],
          ["טווח מתאריך", from ? dateCell(from) : "הכול"],
          ["טווח עד תאריך", to ? dateCell(to) : "הכול"],
          ["דיווחים", reportRows.length],
          ["טיפולים תרופתיים", medicationRows.length],
          ["חיסונים", vaccineRows.length],
        ],
      },
    ];
    if (recordType !== "medications" && recordType !== "vaccinations") {
      sheets.push({ name: "דיווחים", headers: reportHeaders, rows: reportRows });
    }
    if (recordType !== "vaccinations") {
      sheets.push({
        name: "טיפולים תרופתיים",
        headers: ["סוג", "שם בעל החיים", "מס׳ שבב", "שם העובד", "שם התרופה", "תאריך טיפול", "משך בימים", "פעמים ביום", "תאריך דיווח"],
        rows: medicationRows,
      });
    }
    if (recordType !== "reports" && recordType !== "medications") {
      sheets.push({
        name: "חיסונים",
        headers: ["סוג", "שם בעל החיים", "שם החיסון", "תאריך מתוכנן", "מצב", "תאריך ביצוע"],
        rows: vaccineRows,
      });
    }

    return new Response(buildWorkbook(sheets), {
      headers: {
        "content-type": "application/vnd.ms-excel; charset=utf-8",
        "content-disposition": `attachment; filename="rehovot-kennel-${todayInIsrael()}.xls"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
