"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/client";
import { formatDateHe, formatTodayHe, inclusiveDays, treatmentEndDate } from "@/lib/dates";
import { toast, toastCaught } from "@/lib/toast";
import type { AnimalRow, NamedItem, SessionUser, Species, TreatmentRow } from "@/lib/types";
import { AddAnimalModal } from "./AddAnimalModal";
import { AnimalDialog } from "./AnimalDialog";
import { AppHeader } from "./AppHeader";
import { CatalogModal } from "./CatalogModal";
import { ExportModal } from "./ExportModal";
import { SettingsModal } from "./SettingsModal";
import { VaccinationModal } from "./VaccinationModal";

type Bootstrap = {
  user: SessionUser;
  animals: AnimalRow[];
  staff: { id: number; displayName: string; role: string }[];
  symptoms: NamedItem[];
  medications: NamedItem[];
  treatments: TreatmentRow[];
  archived: { id: number; name: string }[];
};

export function KennelApp({ species }: { species: Species }) {
  const isDog = species === "dog";
  const noun = isDog ? "כלבים" : "חתולים";
  const one = isDog ? "כלב" : "חתול";
  const [data, setData] = useState<Bootstrap | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "yes" | "no">("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [medsOpen, setMedsOpen] = useState(false);
  const [vaccinesOpen, setVaccinesOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);

  async function load(silent = false) {
    const next = await api<Bootstrap>(`/api/bootstrap?species=${species}`, silent ? { silent: true } : undefined);
    setData(next);
    setLoadFailed(false);
  }

  useEffect(() => {
    let live = true;
    load().catch((e) => {
      toastCaught(e, "טעינת הנתונים נכשלה");
      if (live) setLoadFailed(true);
    });
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load(true).catch(() => undefined);
    }, 20000);
    return () => {
      live = false;
      clearInterval(timer);
    };
  }, [species]);

  const shown = useMemo(() => {
    const animals = data?.animals || [];
    return animals
      .filter((animal) => {
        const q = query.trim();
        if (!q) return true;
        const chipQ = q.replace(/[\s-]/g, "");
        return (
          animal.name.includes(q) ||
          (isDog && Boolean(animal.chipNumber && animal.chipNumber.includes(chipQ)))
        );
      })
      .filter((animal) => (filter === "all" ? true : filter === "yes" ? animal.activeReports > 0 : animal.activeReports === 0))
      .sort((a, b) => a.name.localeCompare(b.name, "he"));
  }, [data, query, filter, isDog]);

  const watch = data?.animals.filter((animal) => animal.activeReports > 0).length || 0;
  const oneDay = (data?.treatments || []).filter((row) => row.remaining === 1);

  function flash(message: string) {
    toast.success(message);
  }

  if (!data) {
    return (
      <main className={species === "dog" ? "dogsTheme" : "catsTheme"}>
        <div className="shell">{loadFailed ? "טעינת הנתונים נכשלה. רעננו את הדף." : "טוען נתונים..."}</div>
      </main>
    );
  }

  const modalOpen = Boolean(selectedId || settingsOpen || medsOpen || vaccinesOpen || exportOpen || addOpen);

  return (
    <main className={species === "dog" ? "dogsTheme" : "catsTheme"}>
      <div className="app-surface" inert={modalOpen || undefined}>
      <AppHeader
        user={data.user}
        species={species}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenMedications={() => setMedsOpen(true)}
        onOpenVaccinations={() => setVaccinesOpen(true)}
        onOpenExport={() => setExportOpen(true)}
      />
      <div className="shell">
        <section className="welcome">
          <div>
            <em>📋 דוח ומעקב משותף</em>
            <h1>מצב ה{noun} בכלבייה</h1>
            <p>
              {isDog
                ? `לחצו על ${one} כדי להזין דיווח, לעדכן מספר שבב, או לצפות בהיסטוריה שלו.`
                : `לחצו על ${one} כדי להזין דיווח או לצפות בהיסטוריה שלו.`}
            </p>
          </div>
          <aside>
            <small>📅 היום</small>
            <b>{formatTodayHe()}</b>
          </aside>
        </section>

        <section className="stats">
          <article>
            <i>{species === "dog" ? "🐕" : "🐈"}</i>
            <div>
              <small>סה״כ {noun}</small>
              <b>{data.animals.length}</b>
              <span>ברשימה</span>
            </div>
          </article>
          <article>
            <i>◉</i>
            <div>
              <small>{noun} במעקב</small>
              <b>{watch}</b>
              <span className="amber">דיווחים פעילים</span>
            </div>
          </article>
          <article>
            <i>✓</i>
            <div>
              <small>ללא דיווח פעיל</small>
              <b>{data.animals.length - watch}</b>
              <span className="green">מצב שגרתי</span>
            </div>
          </article>
        </section>

        <div className="trackingLayout">
          <div className="trackingSummary">
          <aside className="durationPanel">
            <div className="durationHead">
              <span>⏱</span>
              <div>
                <h2>ימים במעקב</h2>
              </div>
            </div>
            {watch === 0 ? (
              <div className="durationEmpty">אין כרגע {noun} במעקב</div>
            ) : (
              <div className="durationTableWrap">
                <table className="durationTable">
                  <thead>
                    <tr>
                      <th>שם ה{one}</th>
                      <th>מספר ימים במעקב</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.animals
                      .filter((animal) => animal.activeReports > 0)
                      .map((animal) => {
                        const days = inclusiveDays(animal.oldestActiveDate) || 0;
                        return (
                          <tr key={animal.id} onClick={() => setSelectedId(animal.id)}>
                            <td>
                              <span className="durationAvatar">{animal.name[0]}</span>
                              <span className="identityText">
                                <strong>{animal.name}</strong>
                                {isDog && animal.chipNumber ? (
                                  <small className="chipMeta">שבב {animal.chipNumber}</small>
                                ) : null}
                              </span>
                            </td>
                            <td>
                              <b className="severityBadge" style={severityStyle(days)}>
                                {days}
                              </b>{" "}
                              {days === 1 ? "יום" : "ימים"}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </aside>

          <aside className="durationPanel treatmentPanel">
            <div className="durationHead">
              <span>💊</span>
              <div>
                <h2>ימים שנותרו לסיום הטיפול</h2>
                <p>הטיפולים הקרובים לסיום מופיעים ראשונים</p>
              </div>
            </div>
            {data.treatments.length === 0 ? (
              <div className="durationEmpty">אין כרגע טיפולים תרופתיים פעילים עם משך מוגדר</div>
            ) : (
              <div className="durationTableWrap">
                <table className="durationTable treatmentTable">
                  <thead>
                    <tr>
                      <th>שם ה{one}</th>
                      <th>שם התרופה</th>
                      <th>ימים שנותרו</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.treatments.map((row) => (
                      <tr key={`${row.reportId}-${row.medicationName}`} onClick={() => setSelectedId(row.animalId)}>
                        <td>
                          <span className="durationAvatar">{row.animalName[0]}</span>
                          <strong>{row.animalName}</strong>
                        </td>
                        <td>
                          {row.medicationName}
                          {row.frequencyPerDay > 0 && <small className="frequencyNote">{row.frequencyPerDay} פעמים ביום</small>}
                        </td>
                        <td>
                          <b>{row.remaining}</b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <section className="endingSoon">
              <div className="endingSoonHead">
                <b>נותר יום אחד לסיום הטיפול</b>
                <span>{oneDay.length}</span>
              </div>
              {oneDay.length === 0 ? (
                <p>אין כרגע {noun} שמסיימים טיפול היום</p>
              ) : (
                <table>
                  <thead>
                    <tr>
                      <th>בעל החיים</th>
                      <th>שם התרופה</th>
                      <th>תאריך סיום</th>
                    </tr>
                  </thead>
                  <tbody>
                    {oneDay.map((row) => (
                      <tr key={`${row.reportId}-end`}>
                        <td>
                          <strong>{row.animalName}</strong>
                        </td>
                        <td>
                          {row.medicationName}
                          {row.frequencyPerDay > 0 && <small className="frequencyNote">{row.frequencyPerDay} פעמים ביום</small>}
                        </td>
                        <td>
                          <b>{formatDateHe(treatmentEndDate(row.treatmentDate, row.durationDays))}</b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </aside>
          </div>

          <section className="panel trackingMain">
            <div className="panelHead">
              <div>
                <h2>דוח ומעקב</h2>
                <p>
                  {shown.length} מתוך {data.animals.length} {noun}
                </p>
              </div>
              <button type="button" className="primary addAnimalBtn" onClick={() => setAddOpen(true)}>
                + הוספת {one}
              </button>
            </div>
            <div className="tools">
              <label className="search">
                ⌕
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={isDog ? "חיפוש לפי שם או מס׳ שבב..." : "חיפוש לפי שם..."}
                />
              </label>
              <div className="segments">
                {(["all", "yes", "no"] as const).map((item) => (
                  <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>
                    {item === "all" ? "הכול" : item === "yes" ? "במעקב" : "לא במעקב"}
                  </button>
                ))}
              </div>
            </div>
            <div className="table">
              <table>
                <thead>
                  <tr>
                    <th>שם ה{one}</th>
                    <th>שם העובד</th>
                    <th>תאריך דיווח</th>
                    <th>ימים במעקב</th>
                    <th>מספר דיווחים פעילים</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((animal) => (
                    <tr key={animal.id} onClick={() => setSelectedId(animal.id)}>
                      <td data-x="שם">
                        <span className="name-cell">
                          <i className="avatar">{animal.name[0]}</i>
                          <span className="identityText">
                            <strong>{animal.name}</strong>
                            {isDog && animal.chipNumber ? (
                              <small className="chipMeta">מס׳ שבב {animal.chipNumber}</small>
                            ) : null}
                          </span>
                        </span>
                      </td>
                      <td data-x="שם העובד">{animal.reporter || "—"}</td>
                      <td data-x="תאריך דיווח">{animal.reportDate ? formatDateHe(animal.reportDate) : "—"}</td>
                      <td data-x="ימים במעקב">{animal.activeReports ? inclusiveDays(animal.oldestActiveDate) : "—"}</td>
                      <td data-x="דיווחים פעילים">
                        <span className={`status ${animal.activeReports ? "watch" : "clear"}`}>{animal.activeReports || 0}</span>
                      </td>
                      <td className="row-menu">•••</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
        <footer className="site-footer">
          כל תסמין נשמר כאירוע מעקב נפרד <span>●</span>
        </footer>
      </div>
      </div>

      {selectedId && (
        <AnimalDialog
          animalId={selectedId}
          animal={data.animals.find((animal) => animal.id === selectedId)!}
          species={species}
          user={data.user}
          staff={data.staff}
          symptoms={data.symptoms}
          medications={data.medications}
          onClose={() => setSelectedId(null)}
          onChanged={async (message) => {
            await load();
            flash(message);
          }}
        />
      )}
      {settingsOpen && (
        <SettingsModal
          species={species}
          animals={data.animals}
          symptoms={data.symptoms}
          archived={data.archived}
          onClose={() => setSettingsOpen(false)}
          onChanged={async (message) => {
            await load();
            flash(message);
          }}
        />
      )}
      {medsOpen && (
        <CatalogModal
          title="💊 ניהול תרופות"
          kind="medications"
          items={data.medications}
          onClose={() => setMedsOpen(false)}
          onChanged={async () => {
            await load();
            flash("רשימת התרופות עודכנה");
          }}
        />
      )}
      {vaccinesOpen && <VaccinationModal species={species} onClose={() => setVaccinesOpen(false)} />}
      {exportOpen && (
        <ExportModal
          species={species}
          animals={data.animals}
          onClose={() => setExportOpen(false)}
        />
      )}
      {addOpen && (
        <AddAnimalModal
          species={species}
          onClose={() => setAddOpen(false)}
          onCreated={async (animal) => {
            setAddOpen(false);
            await load();
            flash(`${one} חדש נוסף לרשימה`);
            setSelectedId(animal.id);
          }}
        />
      )}
    </main>
  );
}

function severityStyle(days: number) {
  if (days <= 3) return { backgroundColor: "#ffe100", borderColor: "#9b8500", color: "#171717", boxShadow: "0 0 0 2px #fff7ad" };
  if (days <= 6) return { backgroundColor: "#ff8800", borderColor: "#9b4f00", color: "#171717", boxShadow: "0 0 0 2px #ffd2a3" };
  return { backgroundColor: "#ef2b20", borderColor: "#98140d", color: "#fff", boxShadow: "0 0 0 2px #ffc1bd" };
}
