"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { toast, toastCaught } from "@/lib/toast";
import type { AnimalRow, NamedItem, Species } from "@/lib/types";
import { CatalogEditor } from "./CatalogModal";
import { ModalOverlay } from "./ModalOverlay";

export function SettingsModal({
  species,
  animals,
  symptoms,
  archived,
  onClose,
  onChanged,
}: {
  species: Species;
  animals: AnimalRow[];
  symptoms: NamedItem[];
  archived: { id: number; name: string; chipNumber?: string | null }[];
  onClose: () => void;
  onChanged: (message: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [chipNumber, setChipNumber] = useState("");
  const isDog = species === "dog";
  const noun = isDog ? "כלב" : "חתול";

  async function addAnimal() {
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("יש להזין שם");
      return;
    }
    if (!window.confirm(`להוסיף את ה${noun} “${trimmed}” לרשימה הפעילה?`)) return;
    try {
      await api("/api/animals", {
        method: "POST",
        body: JSON.stringify({ species, name: trimmed, chipNumber: isDog ? chipNumber : null }),
      });
      setName("");
      setChipNumber("");
      await onChanged(`${noun} חדש נוסף לרשימה`);
    } catch (e) {
      toastCaught(e, "הוספה נכשלה");
    }
  }

  async function setActive(id: number, active: boolean, itemName: string, openReports = 0) {
    if (!active) {
      const warning =
        openReports > 0
          ? `ל${noun} “${itemName}” יש ${openReports} דיווחים פעילים. להעביר לארכיון בכל זאת?`
          : `להעביר את “${itemName}” לארכיון? ההיסטוריה נשמרת ואפשר לשחזר.`;
      if (!window.confirm(warning)) return;
    } else if (!window.confirm(`לשחזר את “${itemName}” לרשימה הפעילה?`)) {
      return;
    }
    try {
      await api(`/api/animals/${id}`, { method: "PATCH", body: JSON.stringify({ active }) });
      await onChanged(active ? "בעל החיים שוחזר לרשימה" : "בעל החיים הועבר לארכיון");
    } catch (e) {
      toastCaught(e, "עדכון בעל החיים נכשל");
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <section className="modal settingsModal" role="dialog" aria-modal="true">
        <div className="modalHead">
          <div>
            <span>⚙</span>
            <div>
              <h2>ניהול המערכת</h2>
              <p>אפשר לנהל בעלי חיים, תסמינים והיסטוריה משותפת</p>
            </div>
          </div>
          <button onClick={onClose}>×</button>
        </div>
        <div className="settingsBody">
          <section className="settingSection">
            <h3>➕ הוספת {noun}</h3>
            <form
              className={`addAnimalForm${isDog ? " hasChip" : ""}`}
              onSubmit={(event) => {
                event.preventDefault();
                addAnimal();
              }}
            >
              <input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} placeholder={`שם ה${noun}`} />
              {isDog ? (
                <input
                  value={chipNumber}
                  dir="ltr"
                  autoComplete="off"
                  onChange={(e) => setChipNumber(e.target.value)}
                  placeholder="מס׳ שבב (לא חובה)"
                />
              ) : null}
              <button className="primary" type="submit" disabled={!name.trim()}>
                הוספה
              </button>
            </form>
          </section>
          <section className="settingSection">
            <h3>{noun === "כלב" ? "🐕 כלבים פעילים" : "🐈 חתולים פעילים"}</h3>
            <div className="settingList">
              {animals.map((item) => (
              <div key={item.id}>
                <span style={{ flex: 1, alignSelf: "center" }}>
                  {item.name}
                  {isDog && item.chipNumber ? <small className="chipMeta"> · {item.chipNumber}</small> : null}
                </span>
                <button className="ghost" onClick={() => setActive(item.id, false, item.name, item.activeReports)}>
                  העברה לארכיון
                </button>
              </div>
            ))}
            </div>
          </section>
          <CatalogEditor
            title="תסמינים נצפים"
            kind="symptoms"
            items={symptoms}
            onChanged={() => onChanged("רשימת התסמינים עודכנה")}
          />
          {archived.length > 0 && (
            <section className="settingSection">
              <h3>📦 בארכיון — ניתן לשחזר</h3>
              <div className="settingList">
              {archived.map((item) => (
                <div key={item.id}>
                  <span style={{ flex: 1, alignSelf: "center" }}>
                    {item.name}
                    {isDog && item.chipNumber ? <small className="chipMeta"> · {item.chipNumber}</small> : null}
                  </span>
                  <button className="ghost" onClick={() => setActive(item.id, true, item.name)}>
                    שחזור
                  </button>
                </div>
              ))}
              </div>
            </section>
          )}
        </div>
      </section>
    </ModalOverlay>
  );
}
