import { useSyncExternalStore } from "react";

type Prompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferred: Prompt | null = null;
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

/** true, wenn die Seite in der nativen Android-App (Capacitor) läuft. */
export const isNative = () =>
  (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.() === true;

export const isStandalone = () =>
  isNative() ||
  window.matchMedia("(display-mode: standalone)").matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

export const isIos = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.userAgent.includes("Mac") && navigator.maxTouchPoints > 1);

/* Kurzbefehle der App, z. B. vom Home-Bildschirm: /?go=focus */
const GO: Record<string, [string, string?]> = {
  focus: ["plan", "focus"],
  tasks: ["plan", "tasks"],
  habits: ["plan", "habits"],
  notes: ["plan", "notes"],
  music: ["music"],
  tools: ["tools"],
};

function applyLaunchParams() {
  try {
    const go = new URLSearchParams(window.location.search).get("go");
    if (!go) return;
    const t = GO[go];
    if (!t) return;
    localStorage.setItem("ios-tab", JSON.stringify(t[0]));
    if (t[1]) localStorage.setItem("ios-plan", JSON.stringify(t[1]));
    window.history.replaceState(null, "", window.location.pathname);
  } catch {
    /* Speicher blockiert: einfach normal starten */
  }
}

/** Hält die Farbe der Statusleiste passend zum hellen oder dunklen Design. */
function syncThemeColor() {
  const meta = document.querySelector('meta[name="theme-color"]');
  if (!meta) return;
  const apply = () =>
    meta.setAttribute("content", document.documentElement.dataset["theme"] === "light" ? "#e9eefb" : "#070a14");
  apply();
  new MutationObserver(apply).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["data-theme"],
  });
}

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as Prompt;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferred = null;
    emit();
  });
  applyLaunchParams();
  syncThemeColor();
}

export function registerSW() {
  if (!("serviceWorker" in navigator) || import.meta.env.DEV || isNative()) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      /* z. B. in der nativen App nicht verfügbar */
    });
  });
}

export type InstallState = "installed" | "ready" | "ios" | "other";

const snapshot = (): InstallState =>
  isStandalone() ? "installed" : deferred ? "ready" : isIos() ? "ios" : "other";

export function useInstall(): InstallState {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb);
      return () => {
        subs.delete(cb);
      };
    },
    snapshot,
    () => "other",
  );
}

export async function promptInstall() {
  if (!deferred) return;
  await deferred.prompt();
  try {
    await deferred.userChoice;
  } catch {
    /* ignorieren */
  }
  deferred = null;
  emit();
}
