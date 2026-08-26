"use client";

import { useState } from "react";
import { api } from "@/lib/client";
import { toast, toastCaught } from "@/lib/toast";
import type { NamedItem } from "@/lib/types";
import { ModalOverlay } from "./ModalOverlay";

const nouns = {
  symptoms: { one: "תסמין", many: "תסמינים" },
  medications: { one: "תרופה", many: "תרופות" },
  vaccines: { one: "חיסון", many: "חיסונים" },
};

export function CatalogModal({
  title,
  kind,
  items,
  onClose,
  onChanged,
}: {
  title: string;
  kind: "symptoms" | "medications" | "vaccines";
  items: NamedItem[];
  onClose: () => void;
  onChanged: () => Promise<void>;
}) {
  return (
    <ModalOverlay onClose={onClose}>
      <section className="modal medicationsModal" role="dialog" aria-modal="true">
        <div className="modalHead">
          <div>
            <span>💊</span>
            <div>
              <h2>{title.replace(/^💊\s*/, "")}</h2>
              <p>הוספה, עריכה והסרה מהרשימה המשותפת לכל הצוות</p>
            </div>
          </div>
          <button type="button" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="settingsBody">
          <CatalogEditor title={title} kind={kind} items={items} onChanged={onChanged} />
        </div>
      </section>
    </ModalOverlay>
  );
}

export function CatalogEditor({
  title,
  kind,
  items,
  onChanged,
}: {
  title: string;
  kind: "symptoms" | "medications" | "vaccines";
  items: NamedItem[];
  onChanged: () => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const noun = nouns[kind];

  async function act(payload: Record<string, unknown>) {
    setSaving(true);
    try {
      await api("/api/settings", { method: "POST", body: JSON.stringify({ kind, ...payload }) });
      setValue("");
      await onChanged();
    } catch (e) {
      toastCaught(e, "השמירה נכשלה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="settingSection">
      <h3>{title}</h3>
      <div className="addRow">
        <input
          value={value}
          maxLength={80}
          onChange={(e) => setValue(e.target.value)}
          placeholder={`${noun.one} חדש/ה`}
        />
        <button
          type="button"
          className="primary"
          disabled={saving || !value.trim()}
          onClick={() => {
            const name = value.trim();
            if (!window.confirm(`להוסיף את ה${noun.one} “${name}” לרשימה המשותפת?`)) return;
            return act({ action: "add", name });
          }}
        >
          הוספה
        </button>
      </div>
      <small>
        {items.length} {noun.many} פעילים. הסרה מוציאה מהרשימה לבחירה מהירה, בלי למחוק היסטוריה.
      </small>
      <div className="settingList">
        {items.map((item) => (
          <div key={item.id}>
            <input
              defaultValue={item.name}
              maxLength={80}
              onBlur={(e) => {
                const name = e.target.value.trim();
                if (!name || name === item.name) {
                  e.target.value = item.name;
                  return;
                }
                if (!window.confirm(`לשנות את השם מ“${item.name}” ל“${name}”? זה יתעדכן גם ברשומות קיימות.`)) {
                  e.target.value = item.name;
                  return;
                }
                act({ action: "update", id: item.id, name });
              }}
            />
            <button
              type="button"
              className="danger"
              disabled={saving || (kind === "symptoms" && items.length === 1)}
              onClick={() => {
                if (!window.confirm(`להסיר את “${item.name}” מהרשימה המשותפת?`)) return;
                act({ action: "remove", id: item.id });
              }}
            >
              הסרה
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
