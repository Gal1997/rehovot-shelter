import { createClient } from "@libsql/client";
import { hash } from "bcryptjs";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const dbPath = path.join(process.cwd(), "data", "kennel.db");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS animals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  species TEXT NOT NULL,
  name TEXT NOT NULL,
  chip_number TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS animals_species_name_idx ON animals(species, name);
CREATE TABLE IF NOT EXISTS symptoms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS medication_names (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  animal_id INTEGER NOT NULL,
  reporter_user_id INTEGER,
  reporter_name TEXT NOT NULL,
  symptom_id INTEGER NOT NULL,
  symptom_name TEXT NOT NULL,
  report_date TEXT NOT NULL,
  notes TEXT NOT NULL DEFAULT '',
  closed_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS reports_one_open_symptom_idx ON reports(animal_id, symptom_id) WHERE closed_at IS NULL;
CREATE TABLE IF NOT EXISTS report_medications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  treatment_date TEXT NOT NULL,
  duration_days INTEGER NOT NULL,
  frequency_per_day INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS vaccine_names (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  active INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS vaccinations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vaccine_name TEXT NOT NULL,
  animal_id INTEGER NOT NULL,
  animal_name TEXT NOT NULL,
  animal_species TEXT NOT NULL,
  due_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  completed_date TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`;

function isoDaysAgo(days: number) {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function stamp(daysAgo = 0) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString();
}

async function main() {
  await mkdir(path.dirname(dbPath), { recursive: true });
  const client = createClient({ url: `file:${dbPath}` });
  await client.executeMultiple(SCHEMA);
  try {
    await client.execute("ALTER TABLE animals ADD COLUMN chip_number TEXT");
  } catch {
    /* already exists on current databases */
  }
  await client.execute("DROP INDEX IF EXISTS animals_chip_number_idx");

  const reset = process.argv.includes("--reset");
  const existing = await client.execute("SELECT COUNT(*) AS total FROM users");
  if (Number(existing.rows[0]?.total || 0) > 0 && !reset) {
    console.log("Database already has users. Use npm run db:reset to rebuild demo data.");
    return;
  }

  if (reset) {
    await client.executeMultiple(`
      DELETE FROM report_medications;
      DELETE FROM reports;
      DELETE FROM vaccinations;
      DELETE FROM vaccine_names;
      DELETE FROM medication_names;
      DELETE FROM symptoms;
      DELETE FROM animals;
      DELETE FROM users;
    `);
  }

  const password = await hash("staff123", 10);
  const adminPassword = await hash("admin123", 10);
  const userRows = [
    ["admin", adminPassword, "מנהל המערכת", "admin"],
    ["haim", password, "חיים", "staff"],
    ["yonatan", password, "יונתן", "staff"],
    ["shaked", password, "שקד", "staff"],
    ["tal", password, "טל", "staff"],
  ];
  for (const [username, passwordHash, displayName, role] of userRows) {
    await client.execute({
      sql: "INSERT INTO users (username, password_hash, display_name, role, active, created_at) VALUES (?, ?, ?, ?, 1, ?)",
      args: [username, passwordHash, displayName, role, stamp(20)],
    });
  }

  const dogs = [
    "ברנדה",
    "סודה",
    "טוליפ",
    "אריאל",
    "בורדו",
    "אריאנה",
    "קייסי",
    "מיסיסיפי",
    "קאטו",
    "טיקה",
    "שמפניה",
    "פרדי",
    "מדגסקר",
    "אפריים",
    "ניולה",
    "סיביל",
    "דנבר",
    "אסטרו",
    "רוקט",
    "שיווה",
  ];
  const cats = ["טדי", "קינגטון", "סימה", "סמי", "ענן", "נוזי", "קינמון", "לולה", "מיקה", "שוקו"];
  for (const name of dogs) {
    await client.execute({
      sql: "INSERT INTO animals (species, name, active, created_at, updated_at) VALUES ('dog', ?, 1, ?, ?)",
      args: [name, stamp(18), stamp(1)],
    });
  }
  for (const name of cats) {
    await client.execute({
      sql: "INSERT INTO animals (species, name, active, created_at, updated_at) VALUES ('cat', ?, 1, ?, ?)",
      args: [name, stamp(18), stamp(1)],
    });
  }

  const symptomList = [
    "צואה לא תקינה",
    "מתן שתן חריג",
    "לא אכל / אכל פחות",
    "פצע / סימן גוף חריג",
    "הקאות",
    "התנהגות",
    "משהו אחר",
  ];
  for (const name of symptomList) {
    await client.execute({ sql: "INSERT INTO symptoms (name, active) VALUES (?, 1)", args: [name] });
  }
  for (const name of ["אנטיביוטיקה", "מטרונידזול", "פרוביוטיקה", "משכך כאבים"]) {
    await client.execute({ sql: "INSERT INTO medication_names (name, active) VALUES (?, 1)", args: [name] });
  }
  for (const name of ["כלבת", "משושה", "פילול"]) {
    await client.execute({ sql: "INSERT INTO vaccine_names (name, active) VALUES (?, 1)", args: [name] });
  }

  const users = await client.execute("SELECT id, display_name FROM users");
  const animals = await client.execute("SELECT id, name, species FROM animals");
  const symptoms = await client.execute("SELECT id, name FROM symptoms");
  const byName = Object.fromEntries(users.rows.map((row) => [String(row.display_name), Number(row.id)]));
  const animalId = Object.fromEntries(animals.rows.map((row) => [String(row.name), Number(row.id)]));
  const symptomId = Object.fromEntries(symptoms.rows.map((row) => [String(row.name), Number(row.id)]));

  async function addReport(
    animal: string,
    reporter: string,
    symptom: string,
    daysAgo: number,
    notes: string,
    closedDays: number | null,
    meds: { name: string; daysAgo: number; duration: number; frequency: number }[],
  ) {
    const created = stamp(daysAgo);
    const closedAt = closedDays === null ? null : stamp(closedDays);
    const result = await client.execute({
      sql: `INSERT INTO reports (animal_id, reporter_user_id, reporter_name, symptom_id, symptom_name, report_date, notes, closed_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        animalId[animal],
        byName[reporter],
        reporter,
        symptomId[symptom],
        symptom,
        isoDaysAgo(daysAgo),
        notes,
        closedAt,
        created,
        created,
      ],
    });
    const reportId = Number(result.lastInsertRowid);
    for (const med of meds) {
      await client.execute({
        sql: "INSERT INTO report_medications (report_id, name, treatment_date, duration_days, frequency_per_day) VALUES (?, ?, ?, ?, ?)",
        args: [reportId, med.name, isoDaysAgo(med.daysAgo), med.duration, med.frequency],
      });
    }
  }

  await addReport("ברנדה", "חיים", "צואה לא תקינה", 6, "צואה רכה מהבוקר. הועברה לכלוב שקט.", null, [
    { name: "מטרונידזול", daysAgo: 4, duration: 7, frequency: 2 },
  ]);
  await addReport("סודה", "טל", "פצע / סימן גוף חריג", 3, "שריטה קלה באוזן שמאל.", null, []);
  await addReport("טוליפ", "יונתן", "הקאות", 12, "הקיאה פעמיים אחרי האוכל.", 8, [
    { name: "פרוביוטיקה", daysAgo: 12, duration: 5, frequency: 1 },
  ]);
  await addReport("אריאל", "שקד", "לא אכל / אכל פחות", 1, "אכלה מעט בבוקר.", null, [
    { name: "משכך כאבים", daysAgo: 1, duration: 2, frequency: 2 },
  ]);
  await addReport("טדי", "חיים", "לא אכל / אכל פחות", 5, "חתול חדש, עדיין מתאקלם.", null, [
    { name: "פרוביוטיקה", daysAgo: 5, duration: 6, frequency: 1 },
  ]);
  await addReport("סימה", "טל", "התנהגות", 2, "מתחבאת מאחורי הארון.", null, []);
  await addReport("קינגטון", "יונתן", "צואה לא תקינה", 20, "עבר טיפול והשתפר.", 14, [
    { name: "מטרונידזול", daysAgo: 20, duration: 7, frequency: 2 },
  ]);

  async function addVaccine(
    animal: string,
    species: "dog" | "cat",
    name: string,
    dueDaysAgo: number,
    status: "planned" | "completed",
    completedDaysAgo: number | null,
  ) {
    await client.execute({
      sql: `INSERT INTO vaccinations (vaccine_name, animal_id, animal_name, animal_species, due_date, status, completed_date, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        name,
        animalId[animal],
        animal,
        species,
        isoDaysAgo(dueDaysAgo),
        status,
        completedDaysAgo === null ? null : isoDaysAgo(completedDaysAgo),
        stamp(10),
        stamp(1),
      ],
    });
  }

  await addVaccine("ברנדה", "dog", "כלבת", -10, "planned", null);
  await addVaccine("סודה", "dog", "משושה", 3, "completed", 3);
  await addVaccine("טדי", "cat", "פילול", -4, "planned", null);
  await addVaccine("סימה", "cat", "כלבת", 18, "completed", 18);

  console.log("Demo database ready at data/kennel.db");
  console.log("Admin login:  admin / admin123");
  console.log("Staff login:  haim / staff123   (also yonatan, shaked, tal)");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
