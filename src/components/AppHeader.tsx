"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { SessionUser, Species } from "@/lib/types";
import { useBodyScrollLock } from "@/lib/useBodyScrollLock";

export function AppHeader({
  user,
  species,
  onOpenSettings,
  onOpenMedications,
  onOpenVaccinations,
  onOpenExport,
}: {
  user: SessionUser;
  species?: Species;
  onOpenSettings?: () => void;
  onOpenMedications?: () => void;
  onOpenVaccinations?: () => void;
  onOpenExport?: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const currentSpecies = species || (pathname === "/cats" ? "cat" : "dog");

  useBodyScrollLock(open);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function run(action?: () => void) {
    setOpen(false);
    action?.();
  }

  const links = (
    <>
      <Link className={`nav-btn dogs ${currentSpecies === "dog" && pathname !== "/users" ? "active primary" : ""}`} href="/" onClick={() => setOpen(false)}>
        🐕 כלבים
      </Link>
      <Link className={`nav-btn cats ${currentSpecies === "cat" ? "active" : ""}`} href="/cats" onClick={() => setOpen(false)}>
        🐈 חתולים
      </Link>
      {onOpenVaccinations && (
        <button className="tool-btn vaccines" onClick={() => run(onOpenVaccinations)}>
          💉 ניהול חיסונים
        </button>
      )}
      {onOpenMedications && (
        <button className="tool-btn meds" onClick={() => run(onOpenMedications)}>
          💊 ניהול תרופות
        </button>
      )}
      {onOpenExport && (
        <button className="tool-btn export" onClick={() => run(onOpenExport)}>
          📥 ייצוא לאקסל
        </button>
      )}
      {onOpenSettings && (
        <button className="tool-btn settings" onClick={() => run(onOpenSettings)}>
          ⚙ ניהול מערכת
        </button>
      )}
      {user.role === "admin" && (
        <Link className={`tool-btn users ${pathname === "/users" ? "active" : ""}`} href="/users" onClick={() => setOpen(false)}>
          👤 משתמשים
        </Link>
      )}
      <button className="ghost" onClick={logout}>
        🚪 יציאה
      </button>
    </>
  );

  return (
    <header className="app-header">
      <div className="brand">
        <span>🐾</span>
        <div>
          <b>מעקב כלבים וחתולים - כלביית רחובות</b>
          <small>נתונים והיסטוריה משותפים לכל הצוות</small>
          <div className="brand-meta">{user.displayName}</div>
        </div>
      </div>
      <nav className="headerActions desktop-nav">{links}</nav>
      <button
        className="menu-toggle"
        type="button"
        aria-label={open ? "סגירת התפריט" : "פתיחת התפריט"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className={open ? "burger open" : "burger"}>
          <i />
          <i />
          <i />
        </span>
      </button>
      {open && (
        <div className="menu-backdrop" onClick={() => setOpen(false)}>
          <nav className="nav-drawer" onClick={(event) => event.stopPropagation()}>
            <div className="drawer-user">{user.displayName}</div>
            {links}
          </nav>
        </div>
      )}
    </header>
  );
}
