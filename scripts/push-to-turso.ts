import { createClient } from "@libsql/client";
import path from "node:path";

const TABLES = [
  "users",
  "animals",
  "symptoms",
  "medication_names",
  "reports",
  "report_medications",
  "vaccine_names",
  "vaccinations",
] as const;

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

async function main() {
  const remoteUrl = process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "";
  const authToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN || "";
  if (!remoteUrl.startsWith("libsql:") && !remoteUrl.startsWith("https:")) {
    throw new Error("Set DATABASE_URL to the Turso libsql:// URL");
  }
  if (!authToken) {
    throw new Error("Set TURSO_AUTH_TOKEN");
  }

  const local = createClient({ url: `file:${path.join(process.cwd(), "data", "kennel.db")}` });
  const remote = createClient({ url: remoteUrl, authToken });

  await remote.executeMultiple(SCHEMA);

  for (const table of TABLES) {
    await remote.execute(`DELETE FROM ${table}`);
    const rows = await local.execute(`SELECT * FROM ${table}`);
    if (!rows.rows.length) {
      console.log(`${table}: 0 rows`);
      continue;
    }
    const columns = rows.columns;
    const placeholders = columns.map(() => "?").join(", ");
    const sql = `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${placeholders})`;
    for (const row of rows.rows) {
      await remote.execute({
        sql,
        args: columns.map((column) => row[column] as string | number | null),
      });
    }
    console.log(`${table}: ${rows.rows.length} rows`);
  }

  console.log("Turso database is ready");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
