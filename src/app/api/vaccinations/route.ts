import { requireSessionUser } from "@/lib/auth";
import { handleRouteError, jsonError, jsonOk } from "@/lib/api";
import { isPastOrToday, isTodayOrFuture, isValidDateRange } from "@/lib/validation";
import {
  cancelVaccination,
  completeVaccination,
  listVaccinations,
  recordGivenVaccination,
  scheduleVaccination,
} from "@/lib/queries";

export async function GET(request: Request) {
  try {
    await requireSessionUser();
    const url = new URL(request.url);
    const page = Math.max(1, Number(url.searchParams.get("page") || 1));
    const from = url.searchParams.get("from") || "";
    const to = url.searchParams.get("to") || "";
    if (!isValidDateRange(from, to)) return jsonError("תאריכי הסינון אינם תקינים. מתאריך לא יכול להיות אחרי עד תאריך.");
    return jsonOk(await listVaccinations(page, from, to));
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requireSessionUser();
    const body = (await request.json()) as {
      action?: string;
      id?: number;
      name?: string;
      animalId?: number;
      dueDate?: string;
      completedDate?: string;
    };
    if (body.action === "schedule") {
      if (!body.name?.trim() || !Number.isInteger(Number(body.animalId))) {
        return jsonError("יש לבחור חיסון ובעל חיים");
      }
      if (!isTodayOrFuture(String(body.dueDate || ""))) {
        return jsonError("לתכנון חיסון יש לבחור היום או תאריך עתידי (עד שנתיים קדימה). לחיסון שכבר ניתן בחרו “רישום חיסון שניתן”.");
      }
      await scheduleVaccination({
        name: body.name,
        animalId: Number(body.animalId),
        dueDate: String(body.dueDate),
      });
    } else if (body.action === "record") {
      if (!body.name?.trim() || !Number.isInteger(Number(body.animalId))) {
        return jsonError("יש לבחור חיסון ובעל חיים");
      }
      if (!isPastOrToday(String(body.completedDate || ""))) {
        return jsonError("תאריך מתן החיסון חייב להיות תקין ולא עתידי");
      }
      await recordGivenVaccination({
        name: body.name,
        animalId: Number(body.animalId),
        completedDate: String(body.completedDate),
      });
    } else if (body.action === "complete") {
      if (!Number.isInteger(Number(body.id))) return jsonError("חסר מזהה חיסון");
      if (!isPastOrToday(String(body.completedDate || ""))) {
        return jsonError("תאריך הביצוע חייב להיות תקין ולא עתידי");
      }
      await completeVaccination(Number(body.id), String(body.completedDate));
    } else if (body.action === "cancel") {
      if (!Number.isInteger(Number(body.id))) return jsonError("חסר מזהה חיסון");
      await cancelVaccination(Number(body.id));
    } else {
      return jsonError("פעולה לא תקינה");
    }
    return jsonOk(await listVaccinations());
  } catch (error) {
    return handleRouteError(error);
  }
}
