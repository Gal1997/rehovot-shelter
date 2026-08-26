import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { getDb, readyDb } from "./db";
import { nowIso, remainingTreatmentDays, todayInIsrael } from "./dates";
import { normalizeChipNumber } from "./validation";
import {
  animals,
  medicationNames,
  reportMedications,
  reports,
  symptoms,
  users,
  vaccinations,
  vaccineNames,
} from "./schema";

export type Species = "dog" | "cat";

export type MedicationInput = {
  name: string;
  treatmentDate: string;
  durationDays: number;
  frequencyPerDay: number;
};

function db() {
  return getDb();
}

export async function findUserByUsername(username: string) {
  return db().query.users.findFirst({
    where: eq(users.username, username.trim().toLowerCase()),
  });
}

export async function findActiveUserById(id: number) {
  return db().query.users.findFirst({
    where: and(eq(users.id, id), eq(users.active, true)),
  });
}

export async function listStaff() {
  return db()
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      active: users.active,
    })
    .from(users)
    .orderBy(users.displayName);
}

export async function createUser(input: {
  username: string;
  passwordHash: string;
  displayName: string;
  role: "admin" | "staff";
}) {
  try {
    const [row] = await db()
      .insert(users)
      .values({
        username: input.username.trim().toLowerCase(),
        passwordHash: input.passwordHash,
        displayName: input.displayName.trim(),
        role: input.role,
        active: true,
        createdAt: nowIso(),
      })
      .returning();
    return row;
  } catch {
    throw new Error("שם המשתמש כבר קיים במערכת");
  }
}

export async function countActiveAdmins() {
  const [row] = await db()
    .select({ total: sql<number>`count(*)` })
    .from(users)
    .where(and(eq(users.role, "admin"), eq(users.active, true)));
  return Number(row?.total || 0);
}

export async function updateUser(
  id: number,
  input: { displayName?: string; role?: "admin" | "staff"; active?: boolean; passwordHash?: string },
) {
  const current = await db().query.users.findFirst({ where: eq(users.id, id) });
  if (!current) return null;
  if (
    current.role === "admin" &&
    current.active &&
    (input.active === false || input.role === "staff")
  ) {
    const admins = await countActiveAdmins();
    if (admins <= 1) throw new Error("חייב להישאר לפחות מנהל פעיל אחד במערכת");
  }
  const patch: Partial<typeof users.$inferInsert> = {};
  if (input.displayName) patch.displayName = input.displayName.trim();
  if (input.role) patch.role = input.role;
  if (typeof input.active === "boolean") patch.active = input.active;
  if (input.passwordHash) patch.passwordHash = input.passwordHash;
  if (!Object.keys(patch).length) return findActiveUserById(id);
  await db().update(users).set(patch).where(eq(users.id, id));
  if (input.displayName) {
    await db()
      .update(reports)
      .set({ reporterName: input.displayName.trim() })
      .where(eq(reports.reporterUserId, id));
  }
  return db().query.users.findFirst({ where: eq(users.id, id) });
}

export async function listNamedItems(kind: "symptoms" | "medications" | "vaccines") {
  if (kind === "symptoms") {
    return db().select().from(symptoms).where(eq(symptoms.active, true)).orderBy(symptoms.id);
  }
  if (kind === "medications") {
    return db()
      .select()
      .from(medicationNames)
      .where(eq(medicationNames.active, true))
      .orderBy(medicationNames.name);
  }
  return db().select().from(vaccineNames).where(eq(vaccineNames.active, true)).orderBy(vaccineNames.name);
}

export async function upsertNamedItem(
  kind: "symptoms" | "medications" | "vaccines",
  action: "add" | "update" | "remove",
  input: { id?: number; name?: string },
) {
  const name = input.name?.trim() || "";
  const table = kind === "symptoms" ? symptoms : kind === "medications" ? medicationNames : vaccineNames;
  if (action === "add") {
    if (!name || name.length > 80) throw new Error("יש להזין שם תקין");
    await db()
      .insert(table)
      .values({ name, active: true })
      .onConflictDoUpdate({ target: table.name, set: { active: true } });
    if (kind === "symptoms") {
      await db().update(reports).set({ symptomName: name }).where(eq(reports.symptomName, name));
    }
  } else if (action === "update") {
    if (!input.id || !name || name.length > 80) throw new Error("יש להזין שם תקין");
    const previous = await db().select().from(table).where(eq(table.id, input.id)).then((rows) => rows[0]);
    await db().update(table).set({ name }).where(eq(table.id, input.id));
    if (kind === "symptoms" && previous) {
      await db().update(reports).set({ symptomName: name }).where(eq(reports.symptomId, input.id));
    }
    if (kind === "vaccines" && previous) {
      await db()
        .update(vaccinations)
        .set({ vaccineName: name })
        .where(eq(vaccinations.vaccineName, previous.name));
    }
  } else if (action === "remove") {
    if (!input.id) throw new Error("חסר מזהה");
    if (kind === "symptoms") {
      const active = await db().select().from(symptoms).where(eq(symptoms.active, true));
      if (active.length <= 1) throw new Error("חייב להישאר לפחות תסמין אחד ברשימה");
    }
    await db().update(table).set({ active: false }).where(eq(table.id, input.id));
  }
}

export async function listAnimals(species: Species, includeArchived = false) {
  await readyDb();
  const animalRows = await db()
    .select()
    .from(animals)
    .where(includeArchived ? eq(animals.species, species) : and(eq(animals.species, species), eq(animals.active, true)))
    .orderBy(animals.name);

  const openReports = await db()
    .select({
      animalId: reports.animalId,
      reporterName: reports.reporterName,
      reportDate: reports.reportDate,
      symptomName: reports.symptomName,
      updatedAt: reports.updatedAt,
    })
    .from(reports)
    .innerJoin(animals, eq(reports.animalId, animals.id))
    .where(and(eq(animals.species, species), isNull(reports.closedAt)));

  const byAnimal = new Map<number, typeof openReports>();
  for (const report of openReports) {
    const list = byAnimal.get(report.animalId) || [];
    list.push(report);
    byAnimal.set(report.animalId, list);
  }

  return animalRows.map((animal) => {
    const open = byAnimal.get(animal.id) || [];
    const oldest = [...open].sort((a, b) => a.reportDate.localeCompare(b.reportDate))[0];
    const latest = [...open].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    return {
      id: animal.id,
      species: animal.species,
      name: animal.name,
      chipNumber: animal.chipNumber || null,
      active: animal.active,
      updatedAt: animal.updatedAt,
      reporter: latest?.reporterName || "",
      reportDate: oldest?.reportDate || "",
      oldestActiveDate: oldest?.reportDate || "",
      activeReports: open.length,
      issues: open.map((item) => item.symptomName),
    };
  });
}

export async function addAnimal(species: Species, name: string, chipNumber?: string | null) {
  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 40) throw new Error("יש להזין שם עד 40 תווים");
  const chip = species === "dog" ? normalizeChipNumber(chipNumber) : null;
  const stamp = nowIso();
  try {
    const [row] = await db()
      .insert(animals)
      .values({ species, name: trimmed, chipNumber: chip, active: true, createdAt: stamp, updatedAt: stamp })
      .returning();
    return row;
  } catch {
    const existing = await db().query.animals.findFirst({
      where: and(eq(animals.species, species), eq(animals.name, trimmed)),
    });
    if (existing && !existing.active) {
      await db()
        .update(animals)
        .set({
          active: true,
          chipNumber: species === "dog" ? (chip ?? existing.chipNumber) : null,
          updatedAt: stamp,
        })
        .where(eq(animals.id, existing.id));
      return {
        ...existing,
        active: true,
        chipNumber: species === "dog" ? (chip ?? existing.chipNumber) : null,
        updatedAt: stamp,
      };
    }
    throw new Error("כבר קיים בעל חיים בשם הזה");
  }
}

export async function updateAnimal(id: number, input: { name?: string; chipNumber?: string | null }) {
  const animal = await db().query.animals.findFirst({ where: eq(animals.id, id) });
  if (!animal) throw new Error("בעל החיים לא נמצא");
  const patch: Partial<typeof animals.$inferInsert> = { updatedAt: nowIso() };
  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed || trimmed.length > 40) throw new Error("יש להזין שם עד 40 תווים");
    const duplicate = await db().query.animals.findFirst({
      where: and(eq(animals.species, animal.species), eq(animals.name, trimmed)),
    });
    if (duplicate && duplicate.id !== id) throw new Error("כבר קיים בעל חיים בשם הזה");
    patch.name = trimmed;
  }
  if (animal.species === "cat") {
    patch.chipNumber = null;
  } else if (input.chipNumber !== undefined) {
    patch.chipNumber = normalizeChipNumber(input.chipNumber);
  }
  await db().update(animals).set(patch).where(eq(animals.id, id));
  if (patch.name) {
    await db().update(vaccinations).set({ animalName: patch.name }).where(eq(vaccinations.animalId, id));
  }
  return db().query.animals.findFirst({ where: eq(animals.id, id) });
}

export async function setAnimalActive(id: number, active: boolean) {
  const animal = await db().query.animals.findFirst({ where: eq(animals.id, id) });
  if (!animal) throw new Error("בעל החיים לא נמצא");
  await db().update(animals).set({ active, updatedAt: nowIso() }).where(eq(animals.id, id));
  return { ...animal, active };
}

export async function listTreatments(species?: Species) {
  const rows = await db()
    .select({
      reportId: reports.id,
      animalId: animals.id,
      animalName: animals.name,
      species: animals.species,
      reportDate: reports.reportDate,
      medicationName: reportMedications.name,
      treatmentDate: reportMedications.treatmentDate,
      durationDays: reportMedications.durationDays,
      frequencyPerDay: reportMedications.frequencyPerDay,
    })
    .from(reportMedications)
    .innerJoin(reports, eq(reportMedications.reportId, reports.id))
    .innerJoin(animals, eq(reports.animalId, animals.id))
    .where(
      species
        ? and(isNull(reports.closedAt), eq(animals.active, true), eq(animals.species, species))
        : and(isNull(reports.closedAt), eq(animals.active, true)),
    );

  return rows
    .map((row) => {
      const remaining = remainingTreatmentDays(row.treatmentDate, row.durationDays);
      return { ...row, remaining };
    })
    .filter((row) => row.remaining !== null && row.remaining > 0)
    .sort((a, b) => (a.remaining ?? 0) - (b.remaining ?? 0) || a.animalName.localeCompare(b.animalName, "he"));
}

export async function getAnimalReports(animalId: number, page = 1) {
  const limit = 20;
  const offset = (page - 1) * limit;
  const closed = and(eq(reports.animalId, animalId), sql`${reports.closedAt} is not null`);
  const [history, countRow, active] = await Promise.all([
    db()
      .select()
      .from(reports)
      .where(closed)
      .orderBy(desc(reports.closedAt), desc(reports.id))
      .limit(limit)
      .offset(offset),
    db()
      .select({ total: sql<number>`count(*)` })
      .from(reports)
      .where(closed),
    db()
      .select()
      .from(reports)
      .where(and(eq(reports.animalId, animalId), isNull(reports.closedAt)))
      .orderBy(desc(reports.createdAt), desc(reports.id)),
  ]);

  const reportIds = [...history, ...active].map((row) => row.id);
  const meds = reportIds.length
    ? await db().select().from(reportMedications).where(inArray(reportMedications.reportId, reportIds))
    : [];
  const medsByReport = new Map<number, typeof meds>();
  for (const med of meds) {
    const list = medsByReport.get(med.reportId) || [];
    list.push(med);
    medsByReport.set(med.reportId, list);
  }

  const withMeds = (row: (typeof history)[number]) => ({
    ...row,
    medications: medsByReport.get(row.id) || [],
  });

  return {
    reports: history.map(withMeds),
    activeReports: active.map(withMeds),
    total: Number(countRow[0]?.total || 0),
    page,
    pageSize: limit,
  };
}

export async function findOpenReport(animalId: number, symptomId: number) {
  return db().query.reports.findFirst({
    where: and(eq(reports.animalId, animalId), eq(reports.symptomId, symptomId), isNull(reports.closedAt)),
  });
}

export async function createReport(input: {
  animalId: number;
  reporterUserId: number;
  reporterName: string;
  symptomId: number;
  reportDate: string;
  notes: string;
  medications: MedicationInput[];
}) {
  const animal = await db().query.animals.findFirst({
    where: and(eq(animals.id, input.animalId), eq(animals.active, true)),
  });
  if (!animal) throw new Error("בעל החיים אינו פעיל");
  const symptom = await db().query.symptoms.findFirst({ where: eq(symptoms.id, input.symptomId) });
  if (!symptom) throw new Error("התסמין אינו תקין");
  const open = await findOpenReport(input.animalId, input.symptomId);
  if (open) {
    const error = new Error("כבר קיים דיווח פעיל עם התסמין הזה. ערכו אותו במקום לפתוח דיווח חדש.");
    (error as Error & { status?: number; existingReportId?: number }).status = 409;
    (error as Error & { existingReportId?: number }).existingReportId = open.id;
    throw error;
  }
  const stamp = nowIso();
  const [report] = await db()
    .insert(reports)
    .values({
      animalId: input.animalId,
      reporterUserId: input.reporterUserId,
      reporterName: input.reporterName,
      symptomId: input.symptomId,
      symptomName: symptom.name,
      reportDate: input.reportDate,
      notes: input.notes,
      closedAt: null,
      createdAt: stamp,
      updatedAt: stamp,
    })
    .returning();
  await replaceMedications(report.id, input.medications);
  return getReport(report.id);
}

export async function getReport(id: number) {
  const report = await db().query.reports.findFirst({ where: eq(reports.id, id) });
  if (!report) return null;
  const medications = await db().select().from(reportMedications).where(eq(reportMedications.reportId, id));
  return { ...report, medications };
}

export async function updateReport(input: {
  id: number;
  reporterUserId: number;
  reporterName: string;
  symptomId: number;
  reportDate: string;
  notes: string;
  medications: MedicationInput[];
  expectedUpdatedAt: string;
}) {
  const current = await db().query.reports.findFirst({ where: eq(reports.id, input.id) });
  if (!current || current.closedAt) throw Object.assign(new Error("הדיווח כבר נסגר"), { status: 409 });
  if (current.updatedAt !== input.expectedUpdatedAt) {
    throw Object.assign(new Error("הדיווח השתנה בינתיים על ידי עובד אחר. הנתונים נטענו מחדש."), { status: 409 });
  }
  const symptom = await db().query.symptoms.findFirst({ where: eq(symptoms.id, input.symptomId) });
  if (!symptom) throw new Error("התסמין אינו תקין");
  if (input.symptomId !== current.symptomId) {
    const open = await findOpenReport(current.animalId, input.symptomId);
    if (open) throw Object.assign(new Error("כבר קיים דיווח פעיל עם התסמין הזה"), { status: 409 });
  }
  const stamp = nowIso();
  await db()
    .update(reports)
    .set({
      reporterUserId: input.reporterUserId,
      reporterName: input.reporterName,
      symptomId: input.symptomId,
      symptomName: symptom.name,
      reportDate: input.reportDate,
      notes: input.notes,
      updatedAt: stamp,
    })
    .where(eq(reports.id, input.id));
  await replaceMedications(input.id, input.medications);
  return getReport(input.id);
}

export async function closeReport(id: number) {
  const current = await db().query.reports.findFirst({ where: eq(reports.id, id) });
  if (!current || current.closedAt) throw Object.assign(new Error("הדיווח כבר נסגר"), { status: 409 });
  const stamp = nowIso();
  await db().update(reports).set({ closedAt: stamp, updatedAt: stamp }).where(eq(reports.id, id));
  return getReport(id);
}

export async function deleteOpenReport(id: number) {
  const current = await db().query.reports.findFirst({ where: eq(reports.id, id) });
  if (!current || current.closedAt) {
    throw Object.assign(new Error("הדיווח כבר נסגר או בוטל"), { status: 409 });
  }
  await db().delete(reportMedications).where(eq(reportMedications.reportId, id));
  await db().delete(reports).where(eq(reports.id, id));
}

async function replaceMedications(reportId: number, medications: MedicationInput[]) {
  await db().delete(reportMedications).where(eq(reportMedications.reportId, reportId));
  if (!medications.length) return;
  await db().insert(reportMedications).values(
    medications.map((med) => ({
      reportId,
      name: med.name.trim(),
      treatmentDate: med.treatmentDate,
      durationDays: med.durationDays,
      frequencyPerDay: med.frequencyPerDay,
    })),
  );
  for (const med of medications) {
    await db()
      .insert(medicationNames)
      .values({ name: med.name.trim(), active: true })
      .onConflictDoUpdate({ target: medicationNames.name, set: { active: true } });
  }
}

export async function listVaccinations(page = 1, from = "", to = "") {
  const planned = await db()
    .select()
    .from(vaccinations)
    .where(eq(vaccinations.status, "planned"))
    .orderBy(vaccinations.dueDate, vaccinations.animalName);
  const clauses = [eq(vaccinations.status, "completed")];
  if (from) clauses.push(sql`${vaccinations.completedDate} >= ${from}`);
  if (to) clauses.push(sql`${vaccinations.completedDate} <= ${to}`);
  const limit = 20;
  const offset = (page - 1) * limit;
  const history = await db()
    .select()
    .from(vaccinations)
    .where(and(...clauses))
    .orderBy(desc(vaccinations.completedDate), desc(vaccinations.id))
    .limit(limit)
    .offset(offset);
  const [count] = await db()
    .select({ total: sql<number>`count(*)` })
    .from(vaccinations)
    .where(and(...clauses));
  const names = await listNamedItems("vaccines");
  return {
    names,
    planned,
    history,
    historyTotal: Number(count?.total || 0),
    historyPage: page,
    pageSize: limit,
    today: todayInIsrael(),
  };
}

export async function scheduleVaccination(input: {
  name: string;
  animalId: number;
  dueDate: string;
}) {
  const animal = await db().query.animals.findFirst({
    where: and(eq(animals.id, input.animalId), eq(animals.active, true)),
  });
  if (!animal) throw new Error("בעל החיים אינו פעיל");
  const name = input.name.trim();
  if (!name) throw new Error("יש להזין שם חיסון");
  const duplicate = await db().query.vaccinations.findFirst({
    where: and(
      eq(vaccinations.animalId, animal.id),
      eq(vaccinations.vaccineName, name),
      eq(vaccinations.status, "planned"),
    ),
  });
  if (duplicate) {
    throw Object.assign(new Error("כבר קיים חיסון מתוכנן בשם הזה לאותו בעל חיים"), { status: 409 });
  }
  await db()
    .insert(vaccineNames)
    .values({ name, active: true })
    .onConflictDoUpdate({ target: vaccineNames.name, set: { active: true } });
  const stamp = nowIso();
  await db().insert(vaccinations).values({
    vaccineName: name,
    animalId: animal.id,
    animalName: animal.name,
    animalSpecies: animal.species,
    dueDate: input.dueDate,
    status: "planned",
    completedDate: null,
    createdAt: stamp,
    updatedAt: stamp,
  });
}

export async function recordGivenVaccination(input: {
  name: string;
  animalId: number;
  completedDate: string;
}) {
  const animal = await db().query.animals.findFirst({
    where: and(eq(animals.id, input.animalId), eq(animals.active, true)),
  });
  if (!animal) throw new Error("בעל החיים אינו פעיל");
  const name = input.name.trim();
  if (!name) throw new Error("יש להזין שם חיסון");
  await db()
    .insert(vaccineNames)
    .values({ name, active: true })
    .onConflictDoUpdate({ target: vaccineNames.name, set: { active: true } });
  const stamp = nowIso();
  await db().insert(vaccinations).values({
    vaccineName: name,
    animalId: animal.id,
    animalName: animal.name,
    animalSpecies: animal.species,
    dueDate: input.completedDate,
    status: "completed",
    completedDate: input.completedDate,
    createdAt: stamp,
    updatedAt: stamp,
  });
}

export async function completeVaccination(id: number, completedDate: string) {
  const current = await db().query.vaccinations.findFirst({ where: eq(vaccinations.id, id) });
  if (!current || current.status !== "planned") {
    throw Object.assign(new Error("החיסון כבר עודכן"), { status: 409 });
  }
  await db()
    .update(vaccinations)
    .set({ status: "completed", completedDate, updatedAt: nowIso() })
    .where(eq(vaccinations.id, id));
}

export async function cancelVaccination(id: number) {
  const current = await db().query.vaccinations.findFirst({ where: eq(vaccinations.id, id) });
  if (!current || current.status !== "planned") {
    throw Object.assign(new Error("אפשר לבטל רק חיסון מתוכנן"), { status: 409 });
  }
  await db().delete(vaccinations).where(eq(vaccinations.id, id));
}

export async function exportRows(input: {
  kind: "all" | "dogs" | "cats" | "animal" | "vaccinations";
  species?: Species;
  animalId?: number;
  from?: string;
  to?: string;
  recordType?: "reports" | "medications" | "vaccinations";
  activeOnly?: boolean;
  vaccinationStatus?: "all" | "completed" | "planned";
}) {
  const animalFilter = input.animalId ? eq(reports.animalId, input.animalId) : undefined;
  const speciesFilter =
    input.kind === "dogs" || input.species === "dog"
      ? eq(animals.species, "dog")
      : input.kind === "cats" || input.species === "cat"
        ? eq(animals.species, "cat")
        : undefined;
  const dateFrom = input.from ? sql`${reports.reportDate} >= ${input.from}` : undefined;
  const dateTo = input.to ? sql`${reports.reportDate} <= ${input.to}` : undefined;
  const activeOnly = input.activeOnly ? isNull(reports.closedAt) : undefined;

  const reportRows =
    input.recordType === "vaccinations"
      ? []
      : await db()
          .select({
            id: reports.id,
            animalName: animals.name,
            chipNumber: animals.chipNumber,
            species: animals.species,
            reporter: reports.reporterName,
            issue: reports.symptomName,
            reportDate: reports.reportDate,
            notes: reports.notes,
            closedAt: reports.closedAt,
          })
          .from(reports)
          .innerJoin(animals, eq(reports.animalId, animals.id))
          .where(and(animalFilter, speciesFilter, dateFrom, dateTo, activeOnly))
          .orderBy(desc(reports.id))
          .limit(50000);

  const reportIds = reportRows.map((row) => row.id);
  const meds = reportIds.length
    ? await db().select().from(reportMedications).where(inArray(reportMedications.reportId, reportIds))
    : [];

  const vaccineClauses = [];
  if (input.species) vaccineClauses.push(eq(vaccinations.animalSpecies, input.species));
  if (input.animalId) vaccineClauses.push(eq(vaccinations.animalId, input.animalId));
  if (input.vaccinationStatus && input.vaccinationStatus !== "all") {
    vaccineClauses.push(eq(vaccinations.status, input.vaccinationStatus));
  }
  if (input.from) {
    vaccineClauses.push(
      sql`coalesce(${vaccinations.completedDate}, ${vaccinations.dueDate}) >= ${input.from}`,
    );
  }
  if (input.to) {
    vaccineClauses.push(
      sql`coalesce(${vaccinations.completedDate}, ${vaccinations.dueDate}) <= ${input.to}`,
    );
  }

  const vaccineRows =
    input.recordType === "reports" || input.recordType === "medications"
      ? []
      : await db()
          .select()
          .from(vaccinations)
          .where(vaccineClauses.length ? and(...vaccineClauses) : undefined)
          .orderBy(desc(vaccinations.id))
          .limit(50000);

  return { reportRows, meds, vaccineRows };
}

export async function bootstrap(species: Species) {
  await readyDb();
  const [animalRows, staff, symptomRows, medicationRows, treatmentRows, archived] = await Promise.all([
    listAnimals(species),
    db()
      .select({ id: users.id, displayName: users.displayName, role: users.role })
      .from(users)
      .where(eq(users.active, true))
      .orderBy(users.displayName),
    listNamedItems("symptoms"),
    listNamedItems("medications"),
    listTreatments(species),
    db()
      .select({ id: animals.id, name: animals.name, chipNumber: animals.chipNumber })
      .from(animals)
      .where(and(eq(animals.species, species), eq(animals.active, false)))
      .orderBy(animals.name),
  ]);
  return {
    animals: animalRows,
    staff,
    symptoms: symptomRows,
    medications: medicationRows,
    treatments: treatmentRows,
    archived,
    today: todayInIsrael(),
  };
}

