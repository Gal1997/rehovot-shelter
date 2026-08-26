export type ToastKind = "error" | "success";

export type ToastItem = {
  id: number;
  kind: ToastKind;
  message: string;
};

type Listener = () => void;

let nextId = 1;
let toasts: ToastItem[] = [];
const listeners = new Set<Listener>();
const timers = new Map<number, number>();

function emit() {
  listeners.forEach((listener) => listener());
}

function add(kind: ToastKind, message: string) {
  const text = String(message || "").trim();
  if (!text || typeof window === "undefined") return;
  toasts = toasts.filter((item) => item.message !== text || item.kind !== kind);
  const id = nextId++;
  toasts = [...toasts, { id, kind, message: text }].slice(-4);
  emit();
  const wait = kind === "error" ? 7000 : 4000;
  timers.set(id, window.setTimeout(() => toast.dismiss(id), wait));
}

export function getToasts() {
  return toasts;
}

export function subscribeToasts(listener: Listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export const toast = {
  error(message: string) {
    add("error", message);
  },
  success(message: string) {
    add("success", message);
  },
  dismiss(id: number) {
    const timer = timers.get(id);
    if (timer) {
      window.clearTimeout(timer);
      timers.delete(id);
    }
    const next = toasts.filter((item) => item.id !== id);
    if (next.length === toasts.length) return;
    toasts = next;
    emit();
  },
};

export function isToastedError(error: unknown) {
  return Boolean(error && typeof error === "object" && "toasted" in error && (error as { toasted?: boolean }).toasted);
}

export function toastCaught(error: unknown, fallback: string) {
  if (isToastedError(error)) return;
  toast.error(error instanceof Error && error.message ? error.message : fallback);
}
