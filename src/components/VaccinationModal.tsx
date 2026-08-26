"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { formatDateHe, todayInIsrael } from "@/lib/dates";
import { toast, toastCaught } from "@/lib/toast";
import { EARLIEST_DATE, isPastOrToday, isTodayOrFuture, isValidDateRange, yearsAhead } from "@/lib/validation";
import type { NamedItem, Species, VaccinationRow } from "@/lib/types";
import { CatalogEditor } from "./CatalogModal";
import { ModalOverlay } from "./ModalOverlay";

type Payload = {
  names: NamedItem[];
  planned: VaccinationRow[];
  history: VaccinationRow[];
  historyTotal: number;
  historyPage: number;
  pageSize?: number;
  today: string;
};

type Animal = { id: number; name: string; species: Species; chipNumber?: string | null };

export function VaccinationModal({ species, onClose }: { species: Species; onClose: () => void }) {
  const today = todayInIsrael();
  const [data, setData] = useState<Payload | null>(null);
  const [dogs, setDogs] = useState<Animal[]>([]);
  const [cats, setCats] = useState<Animal[]>([]);
  const [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<"plan" | "given">("plan");
  const [vaccineName, setVaccineName] = useState("");
  const [animalType, setAnimalType] = useState<Species>(species);
  const [animalId, setAnimalId] = useState("");
  const [shotDate, setShotDate] = useState(today);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [completeDates, setCompleteDates] = useState<Record<number, string>>({});

  const animals = useMemo(
    () => (animalType === "dog" ? dogs : cats).sort((a, b) => a.name.localeCompare(b.name, "he")),
    [animalType, dogs, cats],
  );
  const selectedAnimal = animals.find((item) => String(item.id) === animalId);
  const planned = useMemo(() => {
    const rows = [...(data?.planned || [])];
    return rows.sort((a, b) => {
      const aLate = a.dueDate < today ? 0 : 1;
      const bLate = b.dueDate < today ? 0 : 1;
      return aLate - bLate || a.dueDate.localeCompare(b.dueDate) || a.animalName.localeCompare(b.animalName, "he");
    });
  }, [data, today]);

  async function load(page = 1, range = { from, to }) {
    if (!isValidDateRange(range.from, range.to)) {
      toast.error("מתאריך לא יכול להיות אחרי עד תאריך");
      return;
    }
    const [vaccines, dogData, catData] = await Promise.all([
      api<Payload>(`/api/vaccinations?page=${page}&from=${range.from}&to=${range.to}`),
      api<{ animals: Animal[] }>("/api/animals?species=dog"),
      api<{ animals: Animal[] }>("/api/animals?species=cat"),
    ]);
    setData(vaccines);
    setDogs(dogData.animals);
    setCats(catData.animals);
  }

  useEffect(() => {
    load().catch((e) => toastCaught(e, "טעינת החיסונים נכשלה"));
  }, []);

  function flash(message: string) {
    toast.success(message);
  }

  async function act(payload: Record<string, unknown>) {
    await api("/api/vaccinations", { method: "POST", body: JSON.stringify(payload) });
    await load(1);
  }

  async function submit() {
    const name = vaccineName.trim();
    if (!name) {
      toast.error("יש לבחור או להקליד שם חיסון");
      return;
    }
    if (!animalId || !selectedAnimal) {
      toast.error("יש לבחור בעל חיים");
      return;
    }
    if (mode === "plan" && !isTodayOrFuture(shotDate)) {
      toast.error("לתכנון יש לבחור היום או תאריך עתידי. אם החיסון כבר ניתן, עברו לרישום חיסון שניתן.");
      return;
    }
    if (mode === "given" && !isPastOrToday(shotDate)) {
      toast.error("תאריך המתן חייב להיות היום או תאריך שעבר, לא תאריך עתידי");
      return;
    }
    const when = formatDateHe(shotDate);
    const ok =
      mode === "plan"
        ? window.confirm(`לתכנן את החיסון “${name}” עבור ${selectedAnimal.name} לתאריך ${when}?`)
        : window.confirm(`לרשום ש${selectedAnimal.name} קיבל/ה את החיסון “${name}” בתאריך ${when}?`);
    if (!ok) return;
    setSaving(true);
    try {
      if (mode === "plan") {
        await act({ action: "schedule", name, animalId: Number(animalId), dueDate: shotDate });
        flash("החיסון נוסף לרשימת המתוכננים");
      } else {
        await act({ action: "record", name, animalId: Number(animalId), completedDate: shotDate });
        flash("חיסון שניתן נרשם בהיסטוריה");
      }
      setVaccineName("");
      setAnimalId("");
      setShotDate(today);
    } catch (e) {
      toastCaught(e, "השמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  async function markDone(row: VaccinationRow) {
    const completedDate = completeDates[row.id] || today;
    if (!isPastOrToday(completedDate)) {
      toast.error("תאריך הביצוע חייב להיות היום או תאריך שעבר");
      return;
    }
    if (!window.confirm(`לסמן שבוצע החיסון “${row.vaccineName}” עבור ${row.animalName} בתאריך ${formatDateHe(completedDate)}?`)) {
      return;
    }
    setSaving(true);
    try {
      await act({ action: "complete", id: row.id, completedDate });
      flash("החיסון סומן כבוצע");
    } catch (e) {
      toastCaught(e, "עדכון החיסון נכשל");
    } finally {
      setSaving(false);
    }
  }

  async function cancel(row: VaccinationRow) {
    if (!window.confirm(`לבטל את החיסון המתוכנן “${row.vaccineName}” עבור ${row.animalName}?\nהתכנון יימחק ולא יישמר בהיסטוריה.`)) {
      return;
    }
    setSaving(true);
    try {
      await act({ action: "cancel", id: row.id });
      flash("החיסון המתוכנן בוטל");
    } catch (e) {
      toastCaught(e, "הביטול נכשל");
    } finally {
      setSaving(false);
    }
  }

  const pageSize = data?.pageSize || 20;
  const historyPages = Math.max(1, Math.ceil((data?.historyTotal || 0) / pageSize));

  return (
    <ModalOverlay onClose={onClose}>
      <section className="modal vaccinationModal" role="dialog" aria-modal="true" aria-labelledby="vaccination-title">
        <div className="modalHead">
          <div>
            <span>💉</span>
            <div>
              <h2 id="vaccination-title">ניהול חיסונים</h2>
              <p>תכנון למועד עתידי, או רישום חיסון שכבר ניתן</p>
            </div>
          </div>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="vaccinationBody">
          <section className="vaccinationForm">
            <h3>{mode === "plan" ? "📅 תכנון חיסון" : "💉 רישום חיסון שניתן"}</h3>
            <div className="segments">
              <button type="button" className={mode === "plan" ? "active" : ""} onClick={() => { setMode("plan"); setShotDate(today); }}>
                תכנון למועד עתידי
              </button>
              <button type="button" className={mode === "given" ? "active" : ""} onClick={() => { setMode("given"); setShotDate(today); }}>
                רישום חיסון שכבר ניתן
              </button>
            </div>
            {(data?.names || []).length > 0 && (
              <div className="vaccineChips">
                {data?.names.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={vaccineName === item.name ? "chip-btn selected" : "chip-btn"}
                    onClick={() => setVaccineName(item.name)}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
            )}
            <div className="vaccinationGrid">
              <label className="field">
                שם החיסון *
                <input
                  list="vaccine-names"
                  value={vaccineName}
                  maxLength={100}
                  onChange={(e) => setVaccineName(e.target.value)}
                  placeholder="בחרו מהרשימה או הקלידו שם חדש"
                />
                <span className="field-hint">אפשר לבחור חיסון קיים, או להקליד שם חדש — הוא יישמר ברשימה המשותפת.</span>
                <datalist id="vaccine-names">
                  {(data?.names || []).map((item) => (
                    <option key={item.id} value={item.name} />
                  ))}
                </datalist>
              </label>
              <label className="field">
                סוג *
                <select
                  value={animalType}
                  onChange={(e) => {
                    setAnimalType(e.target.value as Species);
                    setAnimalId("");
                  }}
                >
                  <option value="dog">🐕 כלב</option>
                  <option value="cat">🐈 חתול</option>
                </select>
              </label>
              <label className="field">
                בעל חיים *
                <select value={animalId} onChange={(e) => setAnimalId(e.target.value)}>
                  <option value="">בחרו {animalType === "dog" ? "כלב" : "חתול"}</option>
                  {animals.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                      {animalType === "dog" && item.chipNumber ? ` · ${item.chipNumber}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                {mode === "plan" ? "תאריך מתוכנן *" : "תאריך המתן *"}
                <input
                  type="date"
                  value={shotDate}
                  min={mode === "plan" ? today : EARLIEST_DATE}
                  max={mode === "plan" ? yearsAhead(2) : today}
                  onChange={(e) => setShotDate(e.target.value)}
                />
              </label>
            </div>
            <div className="formActions">
              <button type="button" className="scheduleVaccine" disabled={saving} onClick={submit}>
                {saving ? "שומר..." : mode === "plan" ? "תכנון החיסון" : "רישום החיסון"}
              </button>
            </div>
          </section>

          <CatalogEditor
            title="רשימת חיסונים לבחירה מהירה"
            kind="vaccines"
            items={data?.names || []}
            onChanged={async () => {
              await load(data?.historyPage || 1);
              flash("רשימת החיסונים עודכנה");
            }}
          />

          <section className="vaccinationSection">
            <div className="vaccinationTitle">
              <h3>📋 חיסונים מתוכננים</h3>
              <span>{planned.length}</span>
            </div>
            {planned.length === 0 ? (
              <p className="vaccinationEmpty">אין חיסונים מתוכננים כרגע</p>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>בעל החיים</th>
                      <th>סוג</th>
                      <th>שם החיסון</th>
                      <th>תאריך לביצוע</th>
                      <th>פעולות</th>
                    </tr>
                  </thead>
                  <tbody>
                    {planned.map((row) => {
                      const overdue = row.dueDate < today;
                      return (
                        <tr key={row.id} className={overdue ? "overdue-row" : ""}>
                          <td>
                            <strong>{row.animalName}</strong>
                          </td>
                          <td>{row.animalSpecies === "dog" ? "🐕 כלב" : "🐈 חתול"}</td>
                          <td>{row.vaccineName}</td>
                          <td>
                            <b>{formatDateHe(row.dueDate)}</b>
                            {overdue && <small className="overdue-note">באיחור</small>}
                          </td>
                          <td>
                            <div className="complete-row">
                              <input
                                type="date"
                                min={EARLIEST_DATE}
                                max={today}
                                value={completeDates[row.id] || today}
                                onChange={(e) => setCompleteDates((current) => ({ ...current, [row.id]: e.target.value }))}
                                aria-label="תאריך ביצוע"
                              />
                              <span className="vaccinationActions">
                                <button type="button" disabled={saving} onClick={() => markDone(row)}>
                                  ✓ בוצע
                                </button>
                                <button type="button" className="remove" disabled={saving} onClick={() => cancel(row)}>
                                  ביטול תכנון
                                </button>
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="vaccinationSection historyVaccinations">
            <div className="vaccinationTitle">
              <h3>📜 היסטוריית חיסונים שניתנו</h3>
              <span>{data?.historyTotal || 0}</span>
            </div>
            <div className="vaccinationFilters">
              <label className="field">
                מתאריך ביצוע
                <input type="date" value={from} max={today} onChange={(e) => setFrom(e.target.value)} />
              </label>
              <label className="field">
                עד תאריך ביצוע
                <input type="date" value={to} max={today} onChange={(e) => setTo(e.target.value)} />
              </label>
              <button type="button" className="ghost" disabled={saving} onClick={() => load(1)}>
                סינון
              </button>
              <button
                type="button"
                className="ghost"
                disabled={saving || (!from && !to)}
                onClick={() => {
                  setFrom("");
                  setTo("");
                  load(1, { from: "", to: "" });
                }}
              >
                ניקוי
              </button>
            </div>
            {(data?.history || []).length === 0 ? (
              <p className="vaccinationEmpty">לא נמצאו חיסונים שבוצעו בטווח שנבחר</p>
            ) : (
              <div className="table-wrap">
                <table className="data">
                  <thead>
                    <tr>
                      <th>בעל החיים</th>
                      <th>סוג</th>
                      <th>שם החיסון</th>
                      <th>תאריך מתוכנן</th>
                      <th>תאריך ביצוע</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.history || []).map((row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>{row.animalName}</strong>
                        </td>
                        <td>{row.animalSpecies === "dog" ? "🐕 כלב" : "🐈 חתול"}</td>
                        <td>{row.vaccineName}</td>
                        <td>{formatDateHe(row.dueDate)}</td>
                        <td>
                          <b>{formatDateHe(row.completedDate || "")}</b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {(data?.historyTotal || 0) > pageSize && (
              <div className="pager">
                <button type="button" className="ghost" disabled={(data?.historyPage || 1) === 1} onClick={() => load((data?.historyPage || 1) - 1)}>
                  הקודם
                </button>
                <span>
                  עמוד {data?.historyPage || 1} מתוך {historyPages}
                </span>
                <button type="button" className="ghost" disabled={(data?.historyPage || 1) >= historyPages} onClick={() => load((data?.historyPage || 1) + 1)}>
                  הבא
                </button>
              </div>
            )}
          </section>
        </div>
      </section>
    </ModalOverlay>
  );
}
