import { toast } from "@/lib/toast";

type ApiInit = RequestInit & { silent?: boolean };

function fail(message: string, extra?: Record<string, unknown>, silent = false): never {
  if (!silent) toast.error(message);
  throw Object.assign(new Error(message), { toasted: true, ...extra });
}

export async function api<T>(url: string, init?: ApiInit): Promise<T> {
  const { silent = false, headers, ...fetchInit } = init || {};
  try {
    const response = await fetch(url, {
      cache: "no-store",
      ...fetchInit,
      headers: {
        ...(fetchInit.body ? { "content-type": "application/json" } : {}),
        ...headers,
      },
    });
    const isLogin = url.includes("/api/auth/login");
    if (response.status === 401 && !isLogin) {
      window.location.href = "/login";
      throw Object.assign(new Error("יש להתחבר מחדש"), { toasted: true });
    }
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await response.json();
      if (!response.ok) fail(data.error || "הפעולה נכשלה", data, silent);
      return data as T;
    }
    if (!response.ok) fail("הפעולה נכשלה", undefined, silent);
    return undefined as T;
  } catch (error) {
    if (error && typeof error === "object" && "toasted" in error) throw error;
    fail(error instanceof Error && error.message ? error.message : "אין חיבור לשרת", undefined, silent);
  }
}

export async function downloadExport(params: URLSearchParams) {
  try {
    const response = await fetch(`/api/export?${params}`, { cache: "no-store" });
    if (response.status === 401) {
      window.location.href = "/login";
      throw Object.assign(new Error("יש להתחבר מחדש"), { toasted: true });
    }
    if (!response.ok) {
      const data = await response.json().catch(() => ({ error: "הייצוא נכשל" }));
      fail(data.error || "הייצוא נכשל");
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `rehovot-kennel-${new Date().toISOString().slice(0, 10)}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  } catch (error) {
    if (error && typeof error === "object" && "toasted" in error) throw error;
    fail(error instanceof Error && error.message ? error.message : "הייצוא נכשל");
  }
}
