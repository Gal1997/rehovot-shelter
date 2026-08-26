"use client";

import { FormEvent, useState } from "react";
import { api } from "@/lib/client";
import { toast, toastCaught } from "@/lib/toast";
import type { Species } from "@/lib/types";
import { ModalOverlay } from "./ModalOverlay";

export function AddAnimalModal({
  species,
  onClose,
  onCreated,
}: {
  species: Species;
  onClose: () => void;
  onCreated: (animal: { id: number; name: string; chipNumber: string | null }) => Promise<void>;
}) {
  const isDog = species === "dog";
  const noun = isDog ? "כלב" : "חתול";
  const [name, setName] = useState("");
  const [chipNumber, setChipNumber] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      toast.error("יש להזין שם");
      return;
    }
    setSaving(true);
    try {
      const data = await api<{ animal: { id: number; name: string; chipNumber: string | null } }>("/api/animals", {
        method: "POST",
        body: JSON.stringify({ species, name: trimmed, chipNumber: isDog ? chipNumber : null }),
      });
      await onCreated(data.animal);
    } catch (error) {
      toastCaught(error, "ההוספה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <ModalOverlay onClose={onClose}>
      <form className="modal addAnimalModal" role="dialog" aria-modal="true" onSubmit={submit}>
        <div className="modalHead">
          <div>
            <span>{species === "dog" ? "🐕" : "🐈"}</span>
            <div>
              <h2>הוספת {noun}</h2>
              <p>
                {isDog
                  ? "השם מופיע ברשימה. מספר השבב עוזר לזהות כשיש שמות דומים."
                  : "השם יופיע ברשימת החתולים הפעילים."}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body addAnimalBody">
          <label className="field">
            שם ה{noun} *
            <input
              value={name}
              maxLength={40}
              autoFocus
              placeholder={species === "dog" ? "למשל לוסי" : "למשל מיקה"}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          {isDog ? (
            <label className="field">
              מס׳ שבב
              <input
                value={chipNumber}
                dir="ltr"
                autoComplete="off"
                placeholder="לא חובה"
                onChange={(e) => setChipNumber(e.target.value)}
              />
              <small className="field-hint">לא חובה עכשיו — אפשר להשלים אחר כך בכרטיס של הכלב.</small>
            </label>
          ) : null}
        </div>
        <div className="actions">
          <span />
          <button type="button" className="ghost" onClick={onClose}>
            ביטול
          </button>
          <button className="primary" disabled={saving || !name.trim()}>
            {saving ? "מוסיף..." : `הוספת ${noun}`}
          </button>
        </div>
      </form>
    </ModalOverlay>
  );
}
