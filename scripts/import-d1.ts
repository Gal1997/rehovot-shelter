import { createClient } from "@libsql/client";
import { hash } from "bcryptjs";
import { copyFileSync, existsSync, readFileSync } from "node:fs";
import path from "node:path";

const CAT_ID_OFFSET = 1000;
const WORKER_USERNAMES: Record<string, string> = {
  חיים: "haim",
  יונתן: "yonatan",
  שקד: "shaked",
  טל: "tal",
  תמר: "tamar",
};

type DumpRow = Record<string, unknown>;
type DumpTable = { rows: DumpRow[] };
type Dump = { tables: Record<string, DumpTable> };

const dbPath = path.join(process.cwd(), "data", "kennel.db");
const dumpPath =
  process.argv[2] ||
  path.resolve(process.cwd(), "..", "..", "rehovot-d1-database-handoff", "rehovot-d1-database-backup.json");

function stamp(value: unknown) {
  const text = String(value || "").trim();
  return text || new Date().toISOString();
}

function num(value: unknown) {
  return Number(value || 0);
}

function str(value: unknown) {
  return String(value ?? "").trim();
}

async function setSequence(client: ReturnType<typeof createClient>, table: string, seq: number) {
  await client.execute({ sql: "DELETE FROM sqlite_sequence WHERE name = ?", args: [table] });
  await client.execute({ sql: "INSERT INTO sqlite_sequence (name, seq) VALUES (?, ?)", args: [table, seq] });
}

async function main() {
  if (!existsSync(dumpPath)) {
    throw new Error(`Dump not found: ${dumpPath}`);
  }
  if (!existsSync(dbPath)) {
    throw new Error(`Database not found: ${dbPath}. Run npm run db:seed first.`);
  }

  const dump = JSON.parse(readFileSync(dumpPath, "utf8")) as Dump;
  const tables = dump.tables;
  const backupPath = path.join(process.cwd(), "data", `kennel.pre-d1-import.db`);
  copyFileSync(dbPath, backupPath);

  const client = createClient({ url: `file:${dbPath}` });
  try {
    await client.execute("ALTER TABLE animals ADD COLUMN chip_number TEXT");
  } catch {
    /* already exists */
  }
  await client.execute("DROP INDEX IF EXISTS animals_chip_number_idx");
  const now = new Date().toISOString();

  await client.executeMultiple(`
    DELETE FROM report_medications;
    DELETE FROM reports;
    DELETE FROM vaccinations;
    DELETE FROM vaccine_names;
    DELETE FROM medication_names;
    DELETE FROM symptoms;
    DELETE FROM animals;
  `);

  for (const row of tables.symptoms?.rows || []) {
    await client.execute({
      sql: "INSERT INTO symptoms (id, name, active) VALUES (?, ?, ?)",
      args: [num(row.id), str(row.name), num(row.active) ? 1 : 0],
    });
  }
  for (const row of tables.medications?.rows || []) {
    await client.execute({
      sql: "INSERT INTO medication_names (id, name, active) VALUES (?, ?, ?)",
      args: [num(row.id), str(row.name), num(row.active) ? 1 : 0],
    });
  }
  for (const row of tables.vaccine_names?.rows || []) {
    await client.execute({
      sql: "INSERT INTO vaccine_names (id, name, active) VALUES (?, ?, ?)",
      args: [num(row.id), str(row.name), num(row.active) ? 1 : 0],
    });
  }

  let maxAnimalId = 0;
  for (const row of tables.dogs?.rows || []) {
    const id = num(row.id);
    maxAnimalId = Math.max(maxAnimalId, id);
    await client.execute({
      sql: "INSERT INTO animals (id, species, name, active, created_at, updated_at) VALUES (?, 'dog', ?, ?, ?, ?)",
      args: [id, str(row.name), num(row.active) ? 1 : 0, stamp(row.updated_at), stamp(row.updated_at) || now],
    });
  }
  for (const row of tables.cats?.rows || []) {
    const id = num(row.id) + CAT_ID_OFFSET;
    maxAnimalId = Math.max(maxAnimalId, id);
    await client.execute({
      sql: "INSERT INTO animals (id, species, name, active, created_at, updated_at) VALUES (?, 'cat', ?, ?, ?, ?)",
      args: [id, str(row.name), num(row.active) ? 1 : 0, stamp(row.updated_at), stamp(row.updated_at) || now],
    });
  }

  const existing = await client.execute("SELECT username, display_name FROM users");
  const usernames = new Set(existing.rows.map((row) => String(row.username)));
  const displayNames = new Set(existing.rows.map((row) => String(row.display_name)));
  const staffPassword = await hash("staff123", 10);
  const addedWorkers: string[] = [];

  for (const row of tables.workers?.rows || []) {
    const displayName = str(row.name);
    if (!displayName || displayNames.has(displayName)) continue;
    let username = WORKER_USERNAMES[displayName] || `staff${num(row.id)}`;
    if (usernames.has(username)) username = `${username}${num(row.id)}`;
    await client.execute({
      sql: "INSERT INTO users (username, password_hash, display_name, role, active, created_at) VALUES (?, ?, ?, 'staff', ?, ?)",
      args: [username, staffPassword, displayName, num(row.active) ? 1 : 0, now],
    });
    usernames.add(username);
    displayNames.add(displayName);
    addedWorkers.push(`${displayName} (${username})`);
  }

  const maxes = await client.execute(`
    SELECT
      (SELECT COALESCE(MAX(id), 0) FROM users) AS users,
      (SELECT COALESCE(MAX(id), 0) FROM animals) AS animals,
      (SELECT COALESCE(MAX(id), 0) FROM symptoms) AS symptoms,
      (SELECT COALESCE(MAX(id), 0) FROM medication_names) AS medications,
      (SELECT COALESCE(MAX(id), 0) FROM vaccine_names) AS vaccines
  `);
  const seq = maxes.rows[0];
  await setSequence(client, "users", num(seq?.users));
  await setSequence(client, "animals", Math.max(maxAnimalId, num(seq?.animals)));
  await setSequence(client, "symptoms", num(seq?.symptoms));
  await setSequence(client, "medication_names", num(seq?.medications));
  await setSequence(client, "vaccine_names", num(seq?.vaccines));

  const counts = await client.execute(`
    SELECT
      (SELECT COUNT(*) FROM animals WHERE species = 'dog') AS dogs,
      (SELECT COUNT(*) FROM animals WHERE species = 'cat') AS cats,
      (SELECT COUNT(*) FROM animals WHERE active = 0) AS archived,
      (SELECT COUNT(*) FROM symptoms) AS symptoms,
      (SELECT COUNT(*) FROM medication_names) AS medications,
      (SELECT COUNT(*) FROM vaccine_names) AS vaccines,
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM reports) AS reports,
      (SELECT COUNT(*) FROM vaccinations) AS vaccinations
  `);
  const c = counts.rows[0];
  console.log("D1 snapshot imported.");
  console.log(`Backup: ${backupPath}`);
  console.log(
    `dogs=${c?.dogs} cats=${c?.cats} archived=${c?.archived} symptoms=${c?.symptoms} meds=${c?.medications} vaccines=${c?.vaccines} users=${c?.users} reports=${c?.reports} vaccinations=${c?.vaccinations}`,
  );
  if (addedWorkers.length) console.log("Added staff:", addedWorkers.join(", "));
  console.log("Existing logins were kept. New staff password: staff123");
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
