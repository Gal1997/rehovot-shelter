"use client";

import { useSyncExternalStore } from "react";
import { getToasts, subscribeToasts, toast } from "@/lib/toast";

export function ToastHost() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts);
  if (!toasts.length) return null;

  return (
    <div className="toast-stack" aria-live="assertive" aria-relevant="additions">
      {toasts.map((item) => (
        <div key={item.id} className={`toast toast-${item.kind}`} role={item.kind === "error" ? "alert" : "status"}>
          <span className="toast-icon" aria-hidden>
            {item.kind === "error" ? "!" : "✓"}
          </span>
          <p>{item.message}</p>
          <button type="button" className="toast-close" onClick={() => toast.dismiss(item.id)} aria-label="סגירה">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
