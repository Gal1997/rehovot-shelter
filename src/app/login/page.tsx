"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/client";
import { toastCaught } from "@/lib/toast";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
      router.push(params.get("next") || "/");
      router.refresh();
    } catch (e) {
      toastCaught(e, "ההתחברות נכשלה");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="dogsTheme loginPage">
      <header className="app-header">
        <div className="brand">
          <span>🐾</span>
          <div>
            <b>מעקב כלבים וחתולים - כלביית רחובות</b>
            <small>נתונים והיסטוריה משותפים לכל הצוות</small>
          </div>
        </div>
      </header>
      <section className="panel login-card">
        <div className="panelHead">
          <div>
            <h2>כניסה למערכת</h2>
            <p>כל משתמש מתחבר עם החשבון שלו. ההרשאות זהות לעבודת היומיום.</p>
          </div>
        </div>
        <div className="modal-body">
          <form onSubmit={submit} style={{ display: "grid", gap: 12 }}>
            <label className="field">
              שם משתמש
              <input required value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </label>
            <label className="field">
              סיסמה
              <input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </label>
            <button className="primary" disabled={saving}>
              {saving ? "מתחבר..." : "כניסה"}
            </button>
          </form>
          <p style={{ color: "var(--muted)", fontSize: 13, margin: 0 }}>
            דמו: <b>admin / admin123</b> או <b>haim / staff123</b>
          </p>
        </div>
      </section>
    </main>
  );
}
