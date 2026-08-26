export type SessionUser = {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "staff";
};

export type Species = "dog" | "cat";

export type NamedItem = { id: number; name: string; active?: boolean };

export type AnimalRow = {
  id: number;
  species: Species;
  name: string;
  chipNumber: string | null;
  active: boolean;
  reporter: string;
  reportDate: string;
  oldestActiveDate: string;
  activeReports: number;
  issues: string[];
};

export type Medication = {
  id?: number;
  name: string;
  treatmentDate: string;
  durationDays: number | string;
  frequencyPerDay: number | string;
};

export type ReportRow = {
  id: number;
  animalId: number;
  reporterUserId: number | null;
  reporterName: string;
  symptomId: number;
  symptomName: string;
  reportDate: string;
  notes: string;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  medications: Medication[];
};

export type TreatmentRow = {
  reportId: number;
  animalId: number;
  animalName: string;
  species: Species;
  medicationName: string;
  treatmentDate: string;
  durationDays: number;
  frequencyPerDay: number;
  remaining: number | null;
};

export type VaccinationRow = {
  id: number;
  vaccineName: string;
  animalId: number;
  animalName: string;
  animalSpecies: Species;
  dueDate: string;
  status: "planned" | "completed";
  completedDate: string | null;
};
