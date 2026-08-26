"use client";

import { useEffect, useState } from "react";
import { api, downloadExport } from "@/lib/client";
import { toast, toastCaught } from "@/lib/toast";
import type { AnimalRow, Species } from "@/lib/types";
import { ModalOverlay } from "./ModalOverlay";

export function ExportModal({
  species,
  animals,
  onClose,
}: {
  species: Species;
  animals: AnimalRow[];
  onClose: () => void;
}) {
  const [scope, setScope] = useState<"all" | "species" | "animal">("species");
  const [animalType, setAnimalType] = useState<Species>(species);
  const [animalId, setAnimalId] = useState("");
  const [recordType, setRecordType] = useState<"reports" | "medications" | "vaccinations">("reports");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [animalOptions, setAnimalOptions] = useState(animals);

  useEffect(() => {
    api<{ animals: AnimalRow[] }>(`/api/animals?species=${animalType}`, { silent: true })
      .then((data) => setAnimalOptions(data.animals))
      .catch(() => setAnimalOptions(animals));
  }, [animalType, animals]);

  async function download() {
    if (scope === "animal" && !animalId) {
      toast.error("יש לבחור בעל חיים");
      return;
    }
    if (from && to && from > to) {
      toast.error("תאריך ההתחלה לא יכול להיות אחרי תאריך הסיום");
      return;
    }
    const params = new URLSearchParams();
    params.set("kind", scope === "all" ? "all" : scope === "species" ? (animalType === "dog" ? "dogs" : "cats") : "animal");
    params.set("recordType", recordType);
    if (scope !== "all") params.set("species", animalType);
    if (scope === "animal") params.set("animalId", animalId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    if (activeOnly) params.set("activeOnly", "1");
    setDownloading(true);
    try {
      await downloadExport(params);
      toast.success("הקובץ ירד בהצלחה");
    } catch (e) {
      toastCaught(e, "הייצוא נכשל");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <section className="modal exportModal" role="dialog" aria-modal="true">
        <div className="modalHead">
          <div>
            <span>📥</span>
            <div>
              <h2>ייצוא לאקסל</h2>
              <p>בחרו מה לייצא ואת טווח התאריכים הרצוי.</p>
            </div>
          </div>
          <button onClick={onClose}>×</button>
        </div>
        <div className="exportBody">
          <label className="field">
            מה לייצא
            <select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
              <option value="all">כל הכלבייה</option>
              <option value="species">{animalType === "dog" ? "כל הכלבים" : "כל החתולים"}</option>
              <option value="animal">בעל חיים אחד</option>
            </select>
          </label>
          {scope !== "all" && (
            <label className="field">
              סוג
              <select value={animalType} onChange={(e) => setAnimalType(e.target.value as Species)}>
                <option value="dog">כלבים</option>
                <option value="cat">חתולים</option>
              </select>
            </label>
          )}
          {scope === "animal" && (
            <label className="field">
              בעל חיים
              <select value={animalId} onChange={(e) => setAnimalId(e.target.value)}>
                <option value="">בחירה</option>
                {animalOptions.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </label>
          )}
          <label className="field">
            סוג הרקורד
            <select value={recordType} onChange={(e) => setRecordType(e.target.value as typeof recordType)}>
              <option value="reports">היסטוריית דיווחים</option>
              <option value="medications">היסטוריית תרופות</option>
              <option value="vaccinations">היסטוריית חיסונים</option>
            </select>
          </label>
          {recordType === "reports" && (
          <label className="activeOnlyChoice field" style={{ flexDirection: "row", alignItems: "center" }}>
              <input type="checkbox" checked={activeOnly} onChange={(e) => setActiveOnly(e.target.checked)} />
              דיווחים פעילים בלבד
            </label>
          )}
          <div className="exportDates">
            <label className="field">
              מתאריך
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </label>
            <label className="field">
              עד תאריך
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </label>
          </div>
          <small>אפשר להשאיר את התאריכים ריקים כדי לייצא את כל התקופות.</small>
          <button className="exportDownload" disabled={downloading} onClick={download}>
            {downloading ? "מכין קובץ..." : "📥 הורדת קובץ אקסל"}
          </button>
        </div>
      </section>
    </ModalOverlay>
  );
}
