import { createClient, type Client } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

function databaseUrl() {
  return process.env.DATABASE_URL || process.env.TURSO_DATABASE_URL || "file:./data/kennel.db";
}

function databaseAuthToken() {
  return process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN;
}

function isRemoteDatabase(url: string) {
  return /^(libsql|https|wss):/i.test(url);
}

function ensureLocalDir(url: string) {
  if (isRemoteDatabase(url) || typeof process === "undefined") return;
  const { mkdirSync } = require("node:fs") as typeof import("node:fs");
  mkdirSync("data", { recursive: true });
}

const globalForDb = globalThis as unknown as {
  kennelClient?: Client;
  kennelDb?: ReturnType<typeof drizzle<typeof schema>>;
  kennelSchema?: Promise<void>;
};

function getClient() {
  if (!globalForDb.kennelClient) {
    const url = databaseUrl();
    ensureLocalDir(url);
    globalForDb.kennelClient = createClient({
      url,
      authToken: isRemoteDatabase(url) ? databaseAuthToken() : undefined,
    });
  }
  return globalForDb.kennelClient;
}

function isAlreadyExists(error: unknown) {
  const message = String(error instanceof Error ? error.message : error).toLowerCase();
  return message.includes("duplicate column") || message.includes("already exists");
}

async function ensureSchema() {
  const client = getClient();
  try {
    await client.execute("ALTER TABLE animals ADD COLUMN chip_number TEXT");
  } catch (error) {
    if (!isAlreadyExists(error)) throw error;
  }
  await client.execute("DROP INDEX IF EXISTS animals_chip_number_idx");
  await client.execute("UPDATE animals SET chip_number = NULL WHERE species = 'cat' AND IFNULL(chip_number, '') != ''");
}

export function getDb() {
  if (!globalForDb.kennelDb) {
    globalForDb.kennelDb = drizzle(getClient(), { schema });
  }
  if (!globalForDb.kennelSchema) {
    globalForDb.kennelSchema = ensureSchema();
  }
  return globalForDb.kennelDb;
}

export async function readyDb() {
  const db = getDb();
  await globalForDb.kennelSchema;
  return db;
}
