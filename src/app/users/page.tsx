"use client";

import { FormEvent, Fragment, useEffect, useRef, useState } from "react";
import { AppHeader } from "@/components/AppHeader";
import { api } from "@/lib/client";
import { toast, toastCaught } from "@/lib/toast";
import type { SessionUser } from "@/lib/types";

type UserRow = {
  id: number;
  username: string;
  displayName: string;
  role: "admin" | "staff";
  active: boolean;
};

export default function UsersPage() {
  const [me, setMe] = useState<SessionUser | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadFailed, setLoadFailed] = useState(false);
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("staff");
  const [saving, setSaving] = useState(false);
  const [passwordFor, setPasswordFor] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const activeAdmins = users.filter((user) => user.role === "admin" && user.active).length;

  async function load() {
    const data = await api<{ users: UserRow[] }>("/api/users");
    setUsers(data.users);
  }

  useEffect(() => {
    api<{ user: SessionUser }>("/api/auth/me")
      .then((data) => setMe(data.user))
      .catch((e) => {
        toastCaught(e, "טעינת המשתמש נכשלה");
        setLoadFailed(true);
      });
    load().catch((e) => {
      toastCaught(e, "טעינת המשתמשים נכשלה");
      setLoadFailed(true);
    });
  }, []);

  useEffect(() => {
    if (passwordFor != null) passwordInputRef.current?.focus();
  }, [passwordFor]);

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username.trim())) {
      toast.error("שם המשתמש חייב להיות באנגלית, 3–32 תווים");
      return;
    }
    if (password.length < 6) {
      toast.error("הסיסמה חייבת להכיל לפחות 6 תווים");
      return;
    }
    if (!displayName.trim()) {
      toast.error("יש להזין שם תצוגה");
      return;
    }
    if (!window.confirm(`להוסיף את המשתמש “${displayName.trim()}” (${username.trim().toLowerCase()})?`)) return;
    setSaving(true);
    try {
      await api("/api/users", { method: "POST", body: JSON.stringify({ username, displayName, password, role }) });
      setUsername("");
      setDisplayName("");
      setPassword("");
      setRole("staff");
      toast.success("המשתמש נוסף");
      await load();
    } catch (e) {
      toastCaught(e, "יצירת המשתמש נכשלה");
    } finally {
      setSaving(false);
    }
  }

  async function setActive(user: UserRow) {
    const lastAdmin = user.role === "admin" && user.active && activeAdmins <= 1;
    if (lastAdmin) {
      toast.error("חייב להישאר לפחות מנהל פעיל אחד במערכת");
      return;
    }
    if (user.active) {
      if (!window.confirm(`להשבית את “${user.displayName}”? לא יוכל להתחבר עד לשחזור.`)) return;
    } else if (!window.confirm(`לשחזר את הגישה של “${user.displayName}”?`)) {
      return;
    }
    try {
      await api("/api/users", { method: "PATCH", body: JSON.stringify({ id: user.id, active: !user.active }) });
      toast.success(user.active ? "המשתמש הושבת" : "המשתמש שוחזר");
      await load();
    } catch (e) {
      toastCaught(e, "עדכון המשתמש נכשל");
    }
  }

  function closePasswordForm() {
    setPasswordFor(null);
    setNewPassword("");
    setPasswordError("");
  }

  async function savePassword(event: FormEvent, user: UserRow) {
    event.preventDefault();
    if (newPassword.length < 6) {
      const message = "יש להזין סיסמה חדשה של לפחות 6 תווים";
      setPasswordError(message);
      toast.error(message);
      passwordInputRef.current?.focus();
      return;
    }
    if (!window.confirm(`לשנות את הסיסמה של “${user.displayName}”?`)) return;
    setSavingPassword(true);
    try {
      await api("/api/users", { method: "PATCH", body: JSON.stringify({ id: user.id, password: newPassword }) });
      closePasswordForm();
      toast.success(`הסיסמה של ${user.displayName} עודכנה`);
    } catch (e) {
      toastCaught(e, "עדכון הסיסמה נכשל");
      setPasswordError(e instanceof Error ? e.message : "עדכון הסיסמה נכשל");
    } finally {
      setSavingPassword(false);
    }
  }

  if (!me) {
    return (
      <main className="dogsTheme">
        <div className="shell">{loadFailed ? "טעינת המשתמשים נכשלה. רעננו את הדף." : "טוען..."}</div>
      </main>
    );
  }

  return (
    <main className="dogsTheme">
      <AppHeader user={me} />
      <div className="shell">
        <section className="welcome">
          <div>
            <em>ניהול צוות</em>
            <h1>ניהול משתמשים</h1>
            <p>כולם יכולים לנהל דיווחים. רק מנהל יכול להוסיף או להשבית משתמשים.</p>
          </div>
        </section>
        <form onSubmit={create} className="panel" style={{ display: "grid", gap: 10, marginBottom: 20, padding: 20 }}>
          <h2 style={{ margin: 0 }}>👤 משתמש חדש</h2>
          <label className="field">
            שם משתמש באנגלית *
            <input required minLength={3} maxLength={32} value={username} onChange={(e) => setUsername(e.target.value)} placeholder="haim" />
          </label>
          <label className="field">
            שם תצוגה *
            <input required maxLength={40} value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="חיים" />
          </label>
          <label className="field">
            סיסמה * (לפחות 6 תווים)
            <input required minLength={6} type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
          </label>
          <label className="field">
            תפקיד
            <select value={role} onChange={(e) => setRole(e.target.value as "admin" | "staff")}>
              <option value="staff">עובד</option>
              <option value="admin">מנהל</option>
            </select>
          </label>
          <div className="formActions">
            <button className="primary" disabled={saving}>
              {saving ? "מוסיף..." : "הוספת משתמש"}
            </button>
          </div>
        </form>
        <section className="panel usersPanel">
          <div className="panelHead">
            <div>
              <h2>משתמשים במערכת</h2>
              <p>{users.length} חשבונות</p>
            </div>
          </div>
          <div className="table">
            <table className="users-table">
              <thead>
                <tr>
                  <th>שם</th>
                  <th>משתמש</th>
                  <th>תפקיד</th>
                  <th>מצב</th>
                  <th>פעולות</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const lastAdmin = user.role === "admin" && user.active && activeAdmins <= 1;
                  const editing = passwordFor === user.id;
                  return (
                    <Fragment key={user.id}>
                      <tr className={user.active ? undefined : "inactive-user"}>
                        <td data-x="שם">
                          <span className="name-cell">
                            <i className="avatar">{user.displayName[0]}</i>
                            <strong>{user.displayName}</strong>
                          </span>
                        </td>
                        <td data-x="משתמש">{user.username}</td>
                        <td data-x="תפקיד">
                          <span className="chip">{user.role === "admin" ? "מנהל" : "עובד"}</span>
                        </td>
                        <td data-x="מצב">
                          <span className={`user-status ${user.active ? "on" : "off"}`}>{user.active ? "פעיל" : "מושבת"}</span>
                        </td>
                        <td data-x="פעולות">
                          <div className="user-actions">
                            {!editing && (
                              <button
                                type="button"
                                className="ghost"
                                onClick={() => {
                                  setPasswordFor(user.id);
                                  setNewPassword("");
                            setPasswordError("");
                          }}
                              >
                                שינוי סיסמה
                              </button>
                            )}
                            <button
                              type="button"
                              className={user.active ? "danger" : "ghost"}
                              disabled={lastAdmin}
                              title={lastAdmin ? "חייב להישאר מנהל פעיל אחד" : undefined}
                              onClick={() => setActive(user)}
                            >
                              {user.active ? "השבתה" : "שחזור"}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {editing && (
                        <tr className="password-row">
                          <td colSpan={5}>
                            <form className="password-reset" onSubmit={(event) => savePassword(event, user)}>
                              <label className="field">
                                סיסמה חדשה ל־{user.displayName}
                                <div className="password-reset-row">
                                  <input
                                    ref={passwordInputRef}
                                    type="password"
                                    autoComplete="new-password"
                                    minLength={6}
                                    placeholder="לפחות 6 תווים"
                                    value={newPassword}
                                    onChange={(e) => {
                                      setNewPassword(e.target.value);
                                      setPasswordError("");
                                    }}
                                  />
                                  <button className="primary" disabled={savingPassword}>
                                    {savingPassword ? "שומר..." : "שמירת סיסמה"}
                                  </button>
                                  <button type="button" className="ghost" onClick={closePasswordForm}>
                                    ביטול
                                  </button>
                                </div>
                              </label>
                              {passwordError && <p className="field-error">{passwordError}</p>}
                            </form>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
