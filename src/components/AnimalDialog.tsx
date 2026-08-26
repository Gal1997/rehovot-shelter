"use client";

import { FormEvent, useEffect, useState } from "react";
import { api } from "@/lib/client";
import { formatDateHe, inclusiveDays, todayInIsrael } from "@/lib/dates";
import { toast, toastCaught } from "@/lib/toast";
import { EARLIEST_DATE, medicationError, normalizedMedications } from "@/lib/validation";
import type { AnimalRow, Medication, NamedItem, ReportRow, SessionUser, Species } from "@/lib/types";
import { ModalOverlay } from "./ModalOverlay";

type History = {
  reports: ReportRow[];
  activeReports: ReportRow[];
  total: number;
  page: number;
  pageSize?: number;
};

const emptyMed = (): Medication => ({ name: "", treatmentDate: "", durationDays: "", frequencyPerDay: "" });

export function AnimalDialog({
  animalId,
  animal,
  species,
  user,
  staff,
  symptoms,
  medications,
  onClose,
  onChanged,
}: {
  animalId: number;
  animal: AnimalRow;
  species: Species;
  user: SessionUser;
  staff: { id: number; displayName: string }[];
  symptoms: NamedItem[];
  medications: NamedItem[];
  onClose: () => void;
  onChanged: (message: string) => Promise<void>;
}) {
  const today = todayInIsrael();
  const isDog = species === "dog";
  const noun = isDog ? "כלב" : "חתול";
  const [history, setHistory] = useState<History | null>(null);
  const [name, setName] = useState(animal.name);
  const [chipNumber, setChipNumber] = useState(animal.chipNumber || "");
  const [reporterUserId, setReporterUserId] = useState(user.id);
  const [symptomId, setSymptomId] = useState(0);
  const [reportDate, setReportDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [meds, setMeds] = useState<Medication[]>([emptyMed()]);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<ReportRow | null>(null);

  useEffect(() => {
    setName(animal.name);
    setChipNumber(animal.chipNumber || "");
  }, [animal.id, animal.name, animal.chipNumber]);

  async function load(page = 1) {
    const next = await api<History>(`/api/animals/${animalId}/reports?page=${page}`);
    setHistory(next);
  }

  useEffect(() => {
    load().catch((e) => toastCaught(e, "טעינת ההיסטוריה נכשלה"));
  }, [animalId]);

  function requestClose() {
    if ((dirty || editingId) && !window.confirm("יש שינויים שלא נשמרו. לסגור בלי שמירה?")) return;
    onClose();
  }

  async function saveDetails() {
    if (!name.trim()) {
      toast.error("יש להזין שם");
      return;
    }
    const nameChanged = name.trim() !== animal.name;
    const chipChanged = isDog && (chipNumber.trim() || "") !== (animal.chipNumber || "");
    if (!nameChanged && !chipChanged) return;
    if (nameChanged && !window.confirm(`לשנות את השם ל“${name.trim()}”? השם יתעדכן גם בחיסונים.`)) return;
    setSaving(true);
    try {
      await api(`/api/animals/${animalId}`, {
        method: "PATCH",
        body: JSON.stringify(isDog ? { name: name.trim(), chipNumber } : { name: name.trim() }),
      });
      setDirty(false);
      await onChanged(nameChanged ? `פרטי ה${noun} עודכנו` : "מספר השבב נשמר");
    } catch (e) {
      toastCaught(e, "עדכון הפרטים נכשל");
    } finally {
      setSaving(false);
    }
  }

  async function saveNew(event: FormEvent) {
    event.preventDefault();
    if (!symptomId) {
      toast.error("יש לבחור תסמין נצפה");
      return;
    }
    if (reportDate > today) {
      toast.error("לא ניתן להזין תאריך דיווח עתידי");
      return;
    }
    const medProblem = medicationError(meds);
    if (medProblem) {
      toast.error(medProblem);
      return;
    }
    setSaving(true);
    try {
      const reporter = staff.find((item) => item.id === reporterUserId);
      await api(`/api/animals/${animalId}/reports`, {
        method: "POST",
        body: JSON.stringify({
          reporterUserId,
          reporterName: reporter?.displayName || user.displayName,
          symptomId,
          reportDate,
          notes,
          medications: normalizedMedications(meds),
        }),
      });
      setNotes("");
      setSymptomId(0);
      setMeds([emptyMed()]);
      setDirty(false);
      await load();
      await onChanged("הדיווח הפעיל נשמר");
    } catch (e) {
      const err = e as Error & { existingReportId?: number };
      toastCaught(err, "השמירה נכשלה");
      if (err.existingReportId) {
        const existing = history?.activeReports.find((report) => report.id === err.existingReportId);
        if (existing) {
          setEditingId(existing.id);
          setEditDraft({
            ...existing,
            medications: existing.medications.length ? existing.medications : [emptyMed()],
          });
        }
      }
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (!editDraft) return;
    if (editDraft.reportDate > today) {
      toast.error("לא ניתן להזין תאריך דיווח עתידי");
      return;
    }
    const medProblem = medicationError(editDraft.medications);
    if (medProblem) {
      toast.error(medProblem);
      return;
    }
    setSaving(true);
    try {
      const reporter = staff.find((item) => item.id === (editDraft.reporterUserId || user.id));
      await api(`/api/reports/${editDraft.id}`, {
        method: "PUT",
        body: JSON.stringify({
          reporterUserId: editDraft.reporterUserId || user.id,
          reporterName: reporter?.displayName || editDraft.reporterName,
          symptomId: editDraft.symptomId,
          reportDate: editDraft.reportDate,
          notes: editDraft.notes,
          medications: normalizedMedications(editDraft.medications),
          expectedUpdatedAt: editDraft.updatedAt,
        }),
      });
      setEditingId(null);
      setEditDraft(null);
      await load();
      await onChanged("השינויים בדיווח נשמרו");
    } catch (e) {
      toastCaught(e, "עריכת הדיווח נכשלה");
      await load();
    } finally {
      setSaving(false);
    }
  }

  async function closeReport(report: ReportRow) {
    if (!window.confirm(`לסגור את הדיווח “${report.symptomName}” ולשמור אותו בהיסטוריה?\nאחרי הסגירה הוא לא ייחשב במעקב הפעיל.`)) return;
    setSaving(true);
    try {
      await api(`/api/reports/${report.id}`, { method: "PATCH", body: JSON.stringify({ action: "close" }) });
      await load();
      await onChanged("הדיווח נסגר ונשמר בהיסטוריה");
    } catch (e) {
      toastCaught(e, "סגירת הדיווח נכשלה");
    } finally {
      setSaving(false);
    }
  }

  async function deleteReport(report: ReportRow) {
    if (!window.confirm(`למחוק לחלוטין את הדיווח “${report.symptomName}”?\nהדיווח לא יופיע בהיסטוריה ולא ניתן יהיה לשחזר אותו.`)) return;
    setSaving(true);
    try {
      await api(`/api/reports/${report.id}`, { method: "DELETE" });
      await load();
      await onChanged("הדיווח בוטל ונמחק");
    } catch (e) {
      toastCaught(e, "המחיקה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  const pageSize = history?.pageSize || 20;
  const historyPages = Math.max(1, Math.ceil((history?.total || 0) / pageSize));

  return (
    <ModalOverlay onClose={requestClose}>
      <div className="modal historyModal" role="dialog" aria-modal="true">
        <div className="modalHead">
          <div>
            <span>{species === "dog" ? "🐾" : "🐈"}</span>
            <div>
              <h2>{animal.name}</h2>
              <p>
                {isDog ? (
                  <>
                    {animal.chipNumber ? `מס׳ שבב ${animal.chipNumber}` : "לא הוזן מספר שבב"}
                    {" · "}
                  </>
                ) : null}
                {history?.activeReports.length || 0} דיווחים פעילים
              </p>
            </div>
          </div>
          <button type="button" onClick={requestClose}>
            ×
          </button>
        </div>
        <div className={`renameBox identityBox${isDog ? " hasChip" : ""}`}>
          <label>
            שם ה{noun}
            <input
              value={name}
              maxLength={40}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
            />
          </label>
          {isDog ? (
            <label>
              מס׳ שבב
              <input
                value={chipNumber}
                dir="ltr"
                autoComplete="off"
                placeholder="לא חובה"
                onChange={(e) => {
                  setChipNumber(e.target.value);
                  setDirty(true);
                }}
              />
            </label>
          ) : null}
          <div className="identityActions">
            <button
              type="button"
              disabled={
                saving ||
                !name.trim() ||
                (name.trim() === animal.name &&
                  (!isDog || (chipNumber.trim() || "") === (animal.chipNumber || "")))
              }
              onClick={saveDetails}
            >
              {saving ? "שומר..." : "שמירת פרטים"}
            </button>
            <button
              type="button"
              className="ghost"
              disabled={saving}
              onClick={async () => {
                const openCount = history?.activeReports.length || 0;
                const warning =
                  openCount > 0
                    ? `ל${noun} יש ${openCount} דיווחים פעילים. להעביר לארכיון בכל זאת? ההיסטוריה נשמרת ואפשר לשחזר.`
                    : "להעביר לארכיון? ההיסטוריה נשמרת ואפשר לשחזר מניהול המערכת.";
                if (!window.confirm(warning)) return;
                await api(`/api/animals/${animalId}`, { method: "PATCH", body: JSON.stringify({ active: false }) });
                await onChanged("בעל החיים הועבר לארכיון");
                onClose();
              }}
            >
              ארכיון
            </button>
          </div>
        </div>

        <div className="modal-body">
          {(history?.activeReports.length || 0) === 0 && (
            <p className="empty-note" style={{ padding: "4px 0 8px" }}>אין כרגע דיווחים פעילים. אפשר להוסיף דיווח למטה.</p>
          )}
          {history?.activeReports.map((report) => (
            <article key={report.id} className="activeCard">
              {editingId === report.id && editDraft ? (
                <div style={{ display: "grid", gap: 10 }}>
                  <div className="two-col">
                    <label className="field">
                      שם המדווח *
                      <select
                        value={editDraft.reporterUserId || ""}
                        onChange={(e) => setEditDraft({ ...editDraft, reporterUserId: Number(e.target.value) })}
                      >
                        {staff.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.displayName}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      תסמין *
                      <select
                        value={editDraft.symptomId}
                        onChange={(e) => setEditDraft({ ...editDraft, symptomId: Number(e.target.value) })}
                      >
                        {symptoms.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <label className="field">
                    תאריך דיווח *
                    <input
                      type="date"
                      min={EARLIEST_DATE}
                      max={today}
                      value={editDraft.reportDate}
                      onChange={(e) => setEditDraft({ ...editDraft, reportDate: e.target.value })}
                    />
                  </label>
                  <label className="field">
                    הערות
                    <textarea
                      value={editDraft.notes}
                      maxLength={10000}
                      onChange={(e) => setEditDraft({ ...editDraft, notes: e.target.value })}
                    />
                    <small>{editDraft.notes.length}/10,000</small>
                  </label>
                  <MedicationFields
                    listId={`meds-edit-${report.id}`}
                    medications={editDraft.medications}
                    catalog={medications}
                    onChange={(next) => setEditDraft({ ...editDraft, medications: next })}
                  />
                  <div className="formActions">
                    <button type="button" className="ghost" onClick={() => { setEditingId(null); setEditDraft(null); }}>
                      ביטול עריכה
                    </button>
                    <button type="button" className="primary" disabled={saving} onClick={saveEdit}>
                      שמירת השינויים
                    </button>
                  </div>
                </div>
              ) : (
                <div>
                  <b>{report.symptomName}</b>
                  <div style={{ color: "var(--muted)", fontSize: 13 }}>
                    {formatDateHe(report.reportDate)} · {report.reporterName} · {inclusiveDays(report.reportDate)} ימים במעקב
                  </div>
                  <p>{report.notes || "לא נוספו הערות"}</p>
                  {report.medications.map((med) => (
                    <small className="treatmentDate" key={`${report.id}-${med.name}`}>
                      💊 {med.name}: {formatDateHe(med.treatmentDate)} · {med.durationDays} ימים · {med.frequencyPerDay} פעמים ביום
                    </small>
                  ))}
                  <div className="formActions" style={{ marginTop: 10 }}>
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => {
                        setEditingId(report.id);
                        setEditDraft({
                          ...report,
                          medications: report.medications.length ? report.medications : [emptyMed()],
                        });
                      }}
                    >
                      עריכה
                    </button>
                    <button type="button" className="ghost" disabled={saving} onClick={() => closeReport(report)}>
                      סגירה להיסטוריה
                    </button>
                    <button type="button" className="danger" disabled={saving} onClick={() => deleteReport(report)}>
                      מחיקה
                    </button>
                  </div>
                </div>
              )}
            </article>
          ))}

          <form id="new-report" className="monitor" onSubmit={saveNew}>
            <h3>➕ הוספת דיווח פעיל</h3>
            <div className="two-col">
              <label className="field">
                שם המדווח *
                <select value={reporterUserId} onChange={(e) => setReporterUserId(Number(e.target.value))}>
                  {staff.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.displayName}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                תסמין נצפה *
                <select
                  required
                  value={symptomId || ""}
                  onChange={(e) => {
                    setSymptomId(Number(e.target.value));
                    setDirty(true);
                  }}
                >
                  <option value="">בחרו תסמין</option>
                  {symptoms.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="field" style={{ marginTop: 10 }}>
              תאריך דיווח *
              <input
                type="date"
                required
                min={EARLIEST_DATE}
                max={today}
                value={reportDate}
                onChange={(e) => {
                  setReportDate(e.target.value);
                  setDirty(true);
                }}
              />
            </label>
            <label className="field" style={{ marginTop: 10 }}>
              הערות על האבחנה
              <textarea
                maxLength={10000}
                value={notes}
                onChange={(e) => {
                  setNotes(e.target.value);
                  setDirty(true);
                }}
              />
              <small>{notes.length}/10,000</small>
            </label>
            <MedicationFields
              listId="meds-new"
              medications={meds}
              catalog={medications}
              onChange={(next) => {
                setMeds(next);
                setDirty(true);
              }}
            />
          </form>

          <section className="history">
            <div className="historyTitle">
              <h3>📜 היסטוריית דיווחים שנסגרו</h3>
              <span>{history?.total || 0} אירועים</span>
            </div>
            {(history?.reports || []).length === 0 ? (
              <p className="empty-note">אין עדיין דיווחים שנסגרו. דיווחים פעילים מופיעים למעלה.</p>
            ) : (
              <div className="historyList">
                {(history?.reports || []).map((report) => (
                  <article key={report.id}>
                    <div>
                      <b>{report.symptomName}</b>
                      <time>{formatDateHe(report.reportDate)}</time>
                    </div>
                    <small>נסגר · {report.reporterName}</small>
                    {report.medications.map((med) => (
                      <small className="treatmentDate" key={`${report.id}-${med.name}`}>
                        💊 {med.name}: {formatDateHe(med.treatmentDate)}
                      </small>
                    ))}
                    {report.notes && <p>{report.notes}</p>}
                  </article>
                ))}
              </div>
            )}
            {(history?.total || 0) > pageSize && (
              <div className="pager">
                <button type="button" className="ghost" disabled={history?.page === 1} onClick={() => load((history?.page || 1) - 1)}>
                  הקודם
                </button>
                <span>
                  עמוד {history?.page || 1} מתוך {historyPages}
                </span>
                <button
                  type="button"
                  className="ghost"
                  disabled={(history?.page || 1) >= historyPages}
                  onClick={() => load((history?.page || 1) + 1)}
                >
                  הבא
                </button>
              </div>
            )}
          </section>
        </div>
        <div className="actions">
          <span />
          <button type="button" className="ghost" onClick={requestClose}>
            ביטול
          </button>
          <button className="primary" form="new-report" disabled={saving}>
            {saving ? "שומר..." : "שמירת דיווח פעיל"}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

function MedicationFields({
  listId,
  medications,
  catalog,
  onChange,
}: {
  listId: string;
  medications: Medication[];
  catalog: NamedItem[];
  onChange: (medications: Medication[]) => void;
}) {
  const today = todayInIsrael();
  return (
    <section className="medicationEditor">
      <div className="medicationHead">
        <b>💊 טיפולים תרופתיים (אם ניתנו)</b>
        <button
          type="button"
          className="ghost"
          disabled={medications.length >= 20}
          onClick={() => onChange([...medications, emptyMed()])}
        >
          + הוספת תרופה
        </button>
      </div>
      <p className="field-hint">אם מלאתם שורה, חובה למלא שם, תאריך, משך ותדירות. תאריך הטיפול לא יכול להיות עתידי.</p>
      <datalist id={listId}>
        {catalog.map((item) => (
          <option key={item.id} value={item.name} />
        ))}
      </datalist>
      {medications.map((med, index) => (
        <div key={index} className="medicationRow">
          <label className="field">
            שם התרופה
            <input
              list={listId}
              placeholder="לדוגמה: אמוקסיצילין"
              value={med.name}
              maxLength={100}
              onChange={(e) => onChange(medications.map((item, i) => (i === index ? { ...item, name: e.target.value } : item)))}
            />
          </label>
          <label className="field">
            תאריך הטיפול
            <input
              type="date"
              min={EARLIEST_DATE}
              max={today}
              value={med.treatmentDate}
              onChange={(e) => onChange(medications.map((item, i) => (i === index ? { ...item, treatmentDate: e.target.value } : item)))}
            />
          </label>
          <label className="field">
            משך (ימים)
            <input
              type="number"
              min={1}
              max={365}
              placeholder="7"
              value={med.durationDays}
              onChange={(e) => onChange(medications.map((item, i) => (i === index ? { ...item, durationDays: e.target.value } : item)))}
            />
          </label>
          <label className="field">
            פעמים ביום
            <input
              type="number"
              min={1}
              max={24}
              placeholder="2"
              value={med.frequencyPerDay}
              onChange={(e) => onChange(medications.map((item, i) => (i === index ? { ...item, frequencyPerDay: e.target.value } : item)))}
            />
          </label>
          {medications.length > 1 && (
            <button
              type="button"
              className="removeMedication"
              onClick={() => {
                const filled = med.name || med.treatmentDate || med.durationDays || med.frequencyPerDay;
                if (filled && !window.confirm("להסיר את שורת התרופה הזו מהטופס?")) return;
                onChange(medications.filter((_, i) => i !== index));
              }}
            >
              הסרה
            </button>
          )}
        </div>
      ))}
    </section>
  );
}
