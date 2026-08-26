import { sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role", { enum: ["admin", "staff"] }).notNull().default("staff"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull(),
});

export const animals = sqliteTable(
  "animals",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    species: text("species", { enum: ["dog", "cat"] }).notNull(),
    name: text("name").notNull(),
    chipNumber: text("chip_number"),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [uniqueIndex("animals_species_name_idx").on(table.species, table.name)],
);

export const symptoms = sqliteTable("symptoms", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const medicationNames = sqliteTable("medication_names", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const reports = sqliteTable(
  "reports",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    animalId: integer("animal_id").notNull(),
    reporterUserId: integer("reporter_user_id"),
    reporterName: text("reporter_name").notNull(),
    symptomId: integer("symptom_id").notNull(),
    symptomName: text("symptom_name").notNull(),
    reportDate: text("report_date").notNull(),
    notes: text("notes").notNull().default(""),
    closedAt: text("closed_at"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("reports_one_open_symptom_idx")
      .on(table.animalId, table.symptomId)
      .where(sql`${table.closedAt} is null`),
  ],
);

export const reportMedications = sqliteTable("report_medications", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  reportId: integer("report_id").notNull(),
  name: text("name").notNull(),
  treatmentDate: text("treatment_date").notNull(),
  durationDays: integer("duration_days").notNull(),
  frequencyPerDay: integer("frequency_per_day").notNull(),
});

export const vaccineNames = sqliteTable("vaccine_names", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const vaccinations = sqliteTable("vaccinations", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  vaccineName: text("vaccine_name").notNull(),
  animalId: integer("animal_id").notNull(),
  animalName: text("animal_name").notNull(),
  animalSpecies: text("animal_species", { enum: ["dog", "cat"] }).notNull(),
  dueDate: text("due_date").notNull(),
  status: text("status", { enum: ["planned", "completed"] }).notNull().default("planned"),
  completedDate: text("completed_date"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
